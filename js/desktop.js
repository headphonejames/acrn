initUI = function() {
    $("#freqSlider").slider({
        min: MIN_FREQ,
        max: MAX_FREQ,
        value: defaultFreq,
        slide: function(event, ui) {
            setFrequencyUpdateACRN(ui.value);
        }
    });
    $("#volSlider").slider({
        min: 0,
        max: 100,
        value: defaultVolume,
        slide: function(event, ui) {
            setVolumeValue(ui.value);
        },
        width: 40
    });

	// makes volume slider longer
	$("#volSliderContainer").width($("#volSliderContainer").width() + 200);
	$("#volSlider").width($("#volSlider").width() + 200);

    $("#playToneButton").button();
    $("#playACRNButton").button();
    $("#stopButton").button();
    $("#freqVolSlider").slider({
        min: 0,
        max: 100,
        value: defaultFreqVolume,
        slide: function(event, ui) {
            setFreqVolume(ui.value);
        },
        width: 40
    });
    
    $("#freqAdjustContainer").hide();

}

updateFrequencySlider = function(value) {
    $("#freqSlider").slider({
        value: value
    });
}