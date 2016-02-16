/**
 * Written by James Kirsch
 * http://www.generalfuzz.net
 */

// constants
states = {
    PLAY_TONE: 0,
    PLAY_ACRN: 1,
    STOP: 2
};

ACRN_FREQ_PREFIX = "freq";
ACRN_VOL_FREQ_PREFIX = "freqVol";

MIN_FREQ = 1;
MAX_FREQ = 15000;

// initial config values
var defaultVolume = 25;
var defaultFreq = 8125;
var numFreqs = 4;
var defaultFreqVolume = 100;

// state values
var currentFreq = defaultFreq;
var currentVolume;
var currentState = states.STOP;

var freqAdjust = null;
var freqAdjustValue = null;

// http://www.wiseguysynth.com/larry/convert/bpm_table.htm -> 1.5hz = 90bpm
// we need quarter notes, so 90 * 4 = 360

var tempo = 360;

// obj references
var self = this;
var audiolet = new Audiolet();
var playingPatternEvent;
var synth = null;
var timer;
var freqChoices = [];
// the indexs used to determine which frequency to play in the acrn playback
var freqChoiceIndex = [0, 1, 2, 3];
var freqPattern = [];
var freqVolumes = [];
var currentSelectedFreq = null;
var currentPlayingFreqIndex = null;

$(document).ready(function() {
    // load values from local storage if available
    var updateACRNFreqs = true;
    if (Modernizr.localstorage) {
        if (localStorage.getItem("defaultFreq")) {
            defaultFreq = localStorage.getItem("defaultFreq");
        }
        if (localStorage.getItem("defaultVolume")) {
            defaultVolume = localStorage.getItem("defaultVolume");
        }
        for (var i = 0; i < numFreqs; i++) {
            if (localStorage.getItem(ACRN_FREQ_PREFIX + i)) {
                updateACRNFreqs = false;
                freqChoices[i] = localStorage.getItem(ACRN_FREQ_PREFIX + i);
            }
            if (localStorage.getItem(ACRN_FREQ_PREFIX + "vol" + i)) {
                freqVolumes[i] = localStorage.getItem(ACRN_FREQ_PREFIX + "vol" + i);
            }
        }
    }

    initUI();

    setFrequency(defaultFreq);
    if (updateACRNFreqs) {
        generateACRNFrequencies();
    }
    renderACRNFrequencies();
    setVolumeValue(defaultVolume);

    timer = new (function() {
        var $stopwatch, // Stopwatch element on the page
                incrementTime = 70, // Timer speed in milliseconds
                startTime,
                updateTimer = function() {
            $stopwatch.html(formatTime(Math.round((Date.now()-startTime)/10)));
        },
                init = function() {
            $stopwatch = $('#stopwatch');
            timer.Timer = $.timer(updateTimer, incrementTime, true);
            timer.Timer.pause();
        };
        this.resetStopwatch = function() {
            startTime = Date.now();
            this.Timer.stop().once();
        };
        $(init);
    });


    registerEditable();
});

function registerEditable() {
    $('.editFreq').editable(function(value, settings) {
        if (!isPositiveInteger(value) || value < MIN_FREQ || value > MAX_FREQ) {
            // ignore
            return this.revert;
        }

        var id = $(this).attr('id');
        if (id === "freqValue") {
            setFrequencyUpdateACRN(value);
            updateFrequencySlider(value);
        } else {
            freqNum = $(freqAdjust).attr("id").slice(-1);
            $(freqAdjust).html(value);
            freqChoices[freqNum] = parseInt(value);

            if (Modernizr.localstorage) {
                localStorage.setItem(ACRN_FREQ_PREFIX + freqNum, parseInt(value));
            }
            console.log(ACRN_FREQ_PREFIX + "[" + freqNum + "]" + ": " + parseInt(value));

        }
        return value;
    }, {
        cssclass: 'editText',
        type: 'text'
    });
}
;

function registerEditFrequencies() {
    $(".acrnFreq").click(function() {
        removeEditFreq();
        $("#freqAdjustContainer").slideDown( );
        freqAdjust = this;
        freqAdjustValue = $(this).html();
        $(this).removeClass("acrnFreq");
        $(this).addClass("freqSelected");
        $("#freqValAdjust").html(freqAdjustValue);
        currentSelectedFreq = parseInt($(this).attr("id").slice(-1));
        $("#freqVolSlider").slider("value", freqVolumes[currentSelectedFreq]);
    });
}
;

function removeEditFreq() {
    if (freqAdjust !== null) {
        $(freqAdjust).removeClass("freqSelected");
        $(freqAdjust).addClass("acrnFreq");
    }
    freqAdjust = null;
}
;

function hideFreqAdjust() {
    removeEditFreq();
    $("#freqAdjustContainer").slideUp();
}
;

function resetFreqVolumes() {
    for (var i = 0; i < numFreqs; i++) {
        freqVolumes[i] = defaultFreqVolume;
    }
};

function setFrequencyUpdateACRN(value) {
    setFrequency(value);
    generateACRNFrequencies();
    renderACRNFrequencies();
    resetFreqVolumes();
}

function setFrequency(freq) {
    this.currentFreq = freq;
    hideFreqAdjust();
    $("#freqValue").html(currentFreq);
    if (this.synth !== null && currentState === states.PLAY_TONE) {
        // Set the gate
        this.synth.sine.frequency.setValue(currentFreq);
    }
    if (Modernizr.localstorage) {
        localStorage.setItem("defaultFreq", freq);
    }
}



function setVolumeValue(vol) {
    currentVolume = vol;
    adjustVolume(currentVolume);
    if (Modernizr.localstorage) {
        localStorage.setItem("defaultVolume", vol);
    }
}

function adjustVolume(vol) {
    // first create the volume float value
    vol = vol / 100;
    vol = vol * vol;

    if (this.synth !== null) {
        if (synth instanceof TriggerSynth) {
            //this.synth.gain.gain.setValue(vol);
            this.synth.gainEnv.levels[1].setValue(vol);
        } else {
            // solid tone is much louder
            this.synth.gain.gain.setValue(vol / 1.5);
        }
    }
}

function setFreqVolume(vol) {
    freqVolumes[currentSelectedFreq] = vol;
    if (Modernizr.localstorage) {
        localStorage.setItem(ACRN_FREQ_PREFIX + "vol" + currentSelectedFreq, vol);
    }
}

TriggerSynth = function(audiolet, frequency) {
    AudioletGroup.apply(this, [audiolet, 0, 1]);

    this.sine = new Sine(audiolet, frequency);

    this.gainEnv = new ADSREnvelope(audiolet,
            0, // Gate
            0.1, // Attack
            0.1, // Decay
            .9, // Sustain
            0.08); // Release
    //*/
    this.gainEnvMulAdd = new MulAdd(audiolet, 0.5);
    this.gain = new Gain(audiolet);

    // Connect oscillator
    this.sine.connect(this.gain);
    this.gain.connect(this.outputs[0]);

    // Connect trigger and envelope
    //this.trigger.connect(this.gainEnv);
    this.gainEnv.connect(this.gainEnvMulAdd);
    this.gainEnvMulAdd.connect(this.gain, 0, 1);


};
extend(TriggerSynth, AudioletGroup);

Synth = function(audiolet, frequency) {
    AudioletGroup.apply(this, [audiolet, 0, 1]);

    this.sine = new Sine(audiolet, frequency);
    this.gain = new Gain(audiolet);
    this.gain.gain.setValue(currentVolume / 2);

    // Connect oscillator
    this.sine.connect(this.gain);

    this.gain.connect(this.outputs[0]);

};
extend(Synth, AudioletGroup);

function playTone() {
    if (currentState === states.PLAY_ACRN) {
        stop();
    }
    if (currentState !== states.PLAY_TONE) {
        this.synth = new Synth(audiolet, this.currentFreq);
        adjustVolume(currentVolume);
        // Connect it to the output so we can hear it
        this.synth.connect(audiolet.output);
        currentState = states.PLAY_TONE;
    }
}

function removeHighlightedFreq() {
    $("#" + ACRN_FREQ_PREFIX + currentPlayingFreqIndex).removeClass("acrnFreqPlaying");
}

function highlightCurrentFreq() {
    $("#" + ACRN_FREQ_PREFIX + currentPlayingFreqIndex).addClass("acrnFreqPlaying");
}

function playACRN() {
    if (currentState === states.PLAY_TONE) {
        stop();
    }

    if (currentState !== states.PLAY_ACRN) {
        generateACRNFrequencies();
        // start timer
        timer.resetStopwatch();
        timer.Timer.play();
        // change play state
        currentState = states.PLAY_ACRN;
        // High synth - scheduled as a mono synth (i.e. one instance keeps
        // running and the gate and frequency are switched)
        this.synth = new TriggerSynth(audiolet, this.currentFreq);

        // Connect it to the output so we can hear it
        this.synth.connect(audiolet.output);

        // first set the gate on the ADSR envelope to 1, then alternate to 0
        // trigger release
        var frequencyPattern = new PSequence([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5,
            6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, -2, -1, -1, -1, -1, -1, -1,
            -1, -1, -1, -1, -1, -1, -1, -1], Infinity);

        audiolet.scheduler.setTempo(tempo * 2);
        shufflePattern();

        // init gate values
        this.synth.gainEnv.gate.setValue(0);
        var gateVal = 1;

        // Schedule the patterns to play
        var patterns = [frequencyPattern];
        playingPatternEvent = audiolet.scheduler.play(patterns, 1,
                function(index) {
                    if (index > -1) {
                        removeHighlightedFreq();
                        currentPlayingFreqIndex = freqPattern[index];
                        if (gateVal === 1) {
                            // Set the frequency
                            this.synth.sine.frequency.setValue(freqChoices[currentPlayingFreqIndex]);
                            // set the volume
                            // get the individual frequency volume value
                            var freqVolumeVal = freqVolumes[currentPlayingFreqIndex] / 100;
                            // adjust the frequency volume value by the overall volume value
                            adjustVolume(currentVolume * freqVolumeVal);
                            highlightCurrentFreq();
                        }
                        // Set the gate
                        this.synth.gainEnv.gate.setValue(gateVal);
                        //console.log("set gate: " + gateVal + " freq: " + freqChoices[freqIndex]);
                        // flip the gate
                        gateVal = 1 - gateVal;
                    } else if (index === -1) {
                        shufflePattern();
                    } else {
                        //console.log("stopping: " + gateVal);
                        adjustVolume(currentVolume);
                        this.synth.gainEnv.gate.setValue(0);
                    }
                }.bind(this)
                );
    }
}

function generateACRNFrequencies() {
    // "Equidistant on a logarithmic scale." - There is a factor of 1.44225 between the values.
    /*
     freqChoices = [Math.floor(currentFreq * 0.5), Math.floor(currentFreq * 0.721125),
     Math.floor(currentFreq * 1.0400425), Math.floor(currentFreq * 1.5)];\
     */
    // Calculation from http://www.tinnitustalk.com/threads/acoustic-cr%C2%AE-neuromodulation-do-it-yourself-guide.1469/page-6
    freqChoices = [Math.floor(currentFreq * 0.773 - 44.5), Math.floor(currentFreq * 0.903 - 21.5),
        Math.floor(currentFreq * 1.09 + 52), Math.floor(currentFreq * 1.395 + 26.5)];
    for (var i = 0; i < numFreqs; i++) {
    	freqVolumes[i] = defaultFreqVolume;
    	if (localStorage.getItem(ACRN_FREQ_PREFIX + "vol" + i)) // load in saved volume for frequency-slot, if one exists
    		freqVolumes[i] = localStorage.getItem(ACRN_FREQ_PREFIX + "vol" + i);
    }
    if (Modernizr.localstorage) {
        for (var i = 0; i < numFreqs; i++) {
            localStorage.setItem(ACRN_FREQ_PREFIX + i, freqChoices[i]);
            localStorage.setItem(ACRN_VOL_FREQ_PREFIX + i, freqVolumes[i]);
        }

    }
}

function renderACRNFrequencies() {
    var patternStr = "";
    for (var i = 0; i < freqChoices.length; i++) {
        editFreqNode = $("<span>");
        editFreqNode.addClass("acrnFreq");
        editFreqNode.attr("id", ACRN_FREQ_PREFIX + i);
        editFreqNode.html(freqChoices[i]);
        patternStr += editFreqNode[0].outerHTML + " hz";
        if (i < freqChoices.length - 1) {
            patternStr += ", ";
        }
    }
    $("#freqPattern").html(patternStr);
    registerEditFrequencies();
}

function shufflePattern() {
    this.freqPattern = [];
    for (var i = 0; i < 3; i++) {
        shuffle(freqChoiceIndex);
        this.freqPattern.push.apply(this.freqPattern, freqChoiceIndex);
    }
}

function shuffle(o) {
    for (var j, x, i = o.length; i; j = parseInt(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x)
        ;
    return o;
}

function stop() {
    removeHighlightedFreq();
    if (currentState !== states.STOP) {
        if (currentState === states.PLAY_ACRN) {
            audiolet.scheduler.remove(playingPatternEvent);
            audiolet.scheduler.stop();
        }
        // Connect it to the output so we can hear it
        this.synth.disconnect(audiolet.output);
        currentState = states.STOP;
        timer.Timer.pause();
    }
}

// timer common functions
function pad(number, length) {
    var str = '' + number;
    while (str.length < length) {
        str = '0' + str;
    }
    return str;
}

function formatTime(time) {
    var min = parseInt(time / 6000),
            sec = parseInt(time / 100) - (min * 60),
            hundredths = pad(time - (sec * 100) - (min * 6000), 2);
    return (min > 0 ? pad(min, 2) : "00") + ":" + pad(sec, 2) + ":" + hundredths;
}

function isPositiveInteger(n) {
    var floatN = parseFloat(n);
    return !isNaN(floatN) && isFinite(n) && floatN > 0
            && floatN % 1 == 0;
}
