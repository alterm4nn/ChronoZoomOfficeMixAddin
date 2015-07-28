var visualization = (function () {
    'use strict';

    var visualization = {};

    // Generates and returns an Office.TableData object with sample data.
    visualization.generateSampleData = function () {
        var sampleHeaders = [['Name', 'Grade']];
        var sampleRows = [
			['Ben', 79],
			['Amy', 95],
			['Jacob', 86],
			['Ernie', 93]];
        return new Office.TableData(sampleRows, sampleHeaders);
    }

    // Displays a visualization based on the following parameters:
    //	  $element:  A jQuery element where the visualization will be displayed.
    //	  data:  An Office.TableData object that contains the data.
    //	  errorHandler:  An error callback that accepts a string description.
    visualization.display = function ($element, data, errorHandler) {
        if ((data.rows.length < 1) || (data.rows[0].length < 2)) {
            errorHandler('The data range must contain at least 1 row and at least 2 columns.');
            return;
        }

        var maxBarWidthInPixels = 200;
        var $table = $('<table class="visualization" />');

        if (data.headers.length > 0) {
            var $headerRow = $('<tr />').appendTo($table);
            $('<th />').text(data.headers[0][0]).appendTo($headerRow);
            $('<th />').text(data.headers[0][1]).appendTo($headerRow);
        }

        for (var i = 0; i < data.rows.length; i++) {
            var $row = $('<tr />').appendTo($table);
            var $column1 = $('<td />').appendTo($row);
            var $column2 = $('<td />').appendTo($row);

            $column1.text(data.rows[i][0]);
            var value = data.rows[i][1];
            var width = (maxBarWidthInPixels * value / 100.0);
            var $visualizationBar = $('<div />').appendTo($column2);
            $visualizationBar.addClass('bar').width(width).text(value);
        }

        $element.html($table[0].outerHTML);
    };

    return visualization;
})();