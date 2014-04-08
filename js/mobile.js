initUI = function() {
    $("#freqSlider").change(function() {
        var value = $("#freqSlider").val();
        setFrequencyUpdateACRN(value);
    });

    $("#volSlider").change(function() {
        var value = $("#volSlider").val();
        setVolume(value);
    });

}

updateFrequencySlider = function(value) {
    $("#freqSlider").slider({
        value: value
    });
}