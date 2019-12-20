/**
    D3 GaugeChart
    ========================

    @file      : D3Gauge.js
    @version   : 1.4.0
    @author    : Ivo Sturm
    @date      : 17-9-2019
    @copyright : First Consulting
    @license   : Apache 2

    Documentation
    ========================
    Add a gauge chart based on the D3 library to your application. Features include: full formatting of the arc and needle, including color coding of different sections in the gauge,
	animating the way the pointer behaves, adding a microflow on click of the gauge and rounding of values;
	
	v1.0.1 	Fix for value positioning when using multiple gauge charts on one page.
			Made height of chart 2/3 width of the chart
	v1.1.0  Added validaty check on ranges configured in Modeler, since people configure this wrongly as seen on the forum
	v1.2.0  Upgrade to Mendix 7. Fixed deprecation on store.caller in mx.data.action. Changed to origin:
		Fix for subscriptions trigger double creation of chart.
		Stripped Chart Title setting. 
	v1.2.1	Fix for non-zero starting value introducing ticks2 array.
	v1.3.0	New Feature: Added Gradient Coloring as option; 	
			bugfix: Do not hide domNode anymore. In case of listview with DS MF update function was called twice,once not having a context object, hence hiding the domNode.
	v1.4.0	Upgrade to Mendix 8; Moved to non-minified d3-v4.13.0 to comply with the current D3 version Mendix uses. Minifiying the D3 file doesn't work (ticket 87817 ), so we use the original file.
*/

// Required module list. 
define([
	"dojo/_base/declare",
	"mxui/widget/_WidgetBase",
	"dijit/_TemplatedMixin",
	"mxui/dom",
	"dojo/dom",
	"dojo/on",
	"dojo/dom-style",
	"dojo/_base/array",
	"dojo/_base/lang",
	"dojo/text",
	"dojo/text!D3Gauge/widget/template/D3Gauge.html",
	"D3Gauge/lib/d3-v4"
], function (declare, _WidgetBase, _TemplatedMixin, dom, dojoDom, on, dojoStyle, dojoArray, dojoLang, dojoText, widgetTemplate, d3) {
	"use strict";
	// Declare widget's prototype.
	return declare("D3Gauge.widget.D3Gauge", [_WidgetBase, _TemplatedMixin], {
		// _TemplatedMixin will create our dom node using this HTML template.
		templateString: widgetTemplate,

		// DOM elements
		d3Gauge: null,

		// Internal variables. Non-primitives created in the prototype are shared between all widget instances.
		_handles: null,
		_contextObj: null,
		_progressID: null,
		_logNode: 'D3 Gauge widget: ',

		// dojo.declare.constructor is called to construct the widget instance. Implement to initialize non-primitive properties.
		constructor: function () {

			logger.debug(this.id + ".constructor");
			this._handles = [];
		},

		// dijit._WidgetBase.postCreate is called after constructing the widget. Implement to do extra setup work.
		postCreate: function () {
			logger.debug(this.id + ".postCreate");
			this.hideProgress();
			this.powerGauge = null;

		},

		// mxui.widget._WidgetBase.update is called when context is changed or initialized. Implement to re-render and / or fetch data.
		update: function (obj, callback) {
			logger.debug(this.id + ".update");
			this.hideProgress();
			this._contextObj = obj;
			var objGuid = this._contextObj ? this._contextObj.getGuid() : null;
			if (this.onClickMF) {
				this._setupEvents(objGuid);
			}
			this._resetSubscriptions();
			this._updateRendering();

			if (typeof callback !== "undefined") {
				callback();
			}
		},

		// mxui.widget._WidgetBase.uninitialize is called when the widget is destroyed. Implement to do special tear-down work.
		uninitialize: function () {
			logger.debug(this.id + ".uninitialize");
			// Clean up listeners, helper objects, etc. There is no need to remove listeners added with this.connect / this.subscribe / this.own.
			this.hideProgress();

		},

		// Attach events to HTML dom elements
		_setupEvents: function (objGuid) {

			logger.debug(this.id + "._setupEvents");

			on(this.d3Gauge, 'click', dojo.hitch(this, function (e) {
				this._execMf(this.onClickMF, objGuid);
			}));
		},


		_drawChart: function () {
			logger.debug(this.id + "._drawChart");

			// Widget configured variables
			var value = this._contextObj ? Number(this._contextObj.get(this.valueAttr)) : 0;
			var minValue = this._contextObj ? Number(this._contextObj.get(this.minValueAttr)) : 0;
			var maxValue = this._contextObj ? Number(this._contextObj.get(this.maxValueAttr)) : 100;
			this.range = maxValue - minValue;


			// truncate when over the maximum or under the minimum
			if (value >= maxValue) {
				value = maxValue;
			} else if (value <= minValue) {
				value = minValue;
			}

			if (this.rounding) {
				value = this._roundWithPrecision(value, 0);
			}
			// Build up array with the sections in it. Will be used in rendering the gauge sections via d3 later on.
			var colorArr = this.colorArray;

			if (colorArr.length > 0) {
				this.areaArray = [];

				for (var i = 0; i < colorArr.length; i++) {
					var areaObj = {
						start: (colorArr[i].rangeStart / 100),
						end: (colorArr[i].rangeEnd / 100),
						color: colorArr[i].colorSection
					};
					this.areaArray.push(areaObj);
				}

				this.noTicks = colorArr.length;

				// always sort the array on the rangeEnd attribute. Will help if not put in right order in the Modeler.
				this.areaArray.sort(function (a, b) {
					return parseFloat(a.end) - parseFloat(b.end);
				});
			} else {
				console.error(this._logNode + ' Please configure the Color Gauge Sections part in the Arc tab of the widget settings!');
			}

			// check if range starts with 0 and ends with 1
			var rangeCorrect = true;
			var rangeMessage = "";
			var maxFound = false;

			for (var k = 0; k < this.areaArray.length; k++) {

				// check if first object starts at zero
				if (k === 0) {
					if (this.areaArray[k].start != 0) {
						rangeCorrect = false;
						rangeMessage = 'The first Range should start at 0. Please correct the widget settings! ';
					}
				}
				// check if subsequent objects are joining
				else {
					if (rangeEnd != this.areaArray[k].start) {
						rangeCorrect = false;
						rangeMessage += 'Subsequent ranges should start at the end of the previous range. Please correct the widget settings! ';
					}
				}
				// store rangeEnd so can be used in next iteration to check the rangeStart;	
				var rangeEnd = this.areaArray[k].end;

				if (this.areaArray[k].end == 1) {
					maxFound = true;
				}
			}

			if (maxFound == false) {
				rangeMessage += 'The last range should end at 100. Please correct the widget settings!';
			}

			if (maxFound && rangeMessage == "") {

				// Add modeler configurations to be picked up by d3
				var config = {
					size: this.size,
					clipWidth: this.size,
					clipHeight: this.size,
					ringWidth: this.ringWidth,
					maxValue: maxValue,
					minValue: minValue,
					transitionMs: this.easingDuration,
					majorTicks: this.noTicks,
					areas: this.areaArray,
					tickBorder: this.tickBorder,
					needleRadius: this.needleRadius,
					needleLength: this.needleLength,
					arcGradientColor: this.arcGradientColor
				};
				var easingFunction,
					pointer;
				switch (this.easing) {
					case 'lineaer': easingFunction = d3.easeLinear; break;
					case 'quad': easingFunction = d3.easeQuad; break;
					case 'qubic': easingFunction = d3.easeCubic; break;
					case 'sin': easingFunction = d3.easeSin; break;
					case 'exp': easingFunction = d3.easeExp; break;
					case 'circle': easingFunction = d3.easeCircle; break;
					case 'elastic': easingFunction = d3.easeElastic; break;
					case 'back': easingFunction = d3.easeBack; break;
					case 'bounce': easingFunction = d3.easeBounce; break;
				}
				// update old chart if already created
				if (this.powerGauge) {
					this.powerGauge.update(value, config, easingFunction);
					if (this.displayValue) {
						pointer = d3.selectAll("#" + this.id + " .pointer text").text(value);
					}
				} else {
					// Create the chart.
					this.powerGauge = this._createChart(this.d3Gauge, config);

					// Set the pointer to it's value with some added easing
					this.powerGauge.render(value, this.textColor, this.pointerColor, easingFunction);
				}
				// Hide the value in the bottom of the pointer, if set in the Modeler.
				if (this.displayValue) {
					pointer = d3.selectAll("#" + this.id + " .pointer");
					pointer.append("text")
						.attr('id', "Value")
						.attr("font-size", 20)
						.attr("text-anchor", "middle")
						.attr("dy", "1.5em")
						.style('fill', this.textColor)
						.text(value);
				}

			} else {
				// place errormessage in browser console and where D3 Gauge should be shown
				console.error(this._logNode + rangeMessage);
				this.domNode.innerHTML = '<br>' + this._logNode + rangeMessage;
				this.domNode.style.color = 'red';
				this.domNode.style.fontStyle = 'italic';
			}
		},

		// Rerender the interface.
		_updateRendering: function () {
			logger.debug(this.id + "._updateRendering");

			// Draw or reload.
			if (this._contextObj !== null) {
				this._drawChart();
			}
			// v1.3.0 do not hide domNode anymore. In case of listview with DS MF update function was called twice,once not having a context object, hence hiding the domNode.

		},

		// Reset subscriptions.
		_resetSubscriptions: function () {
			logger.debug(this.id + "._resetSubscriptions");

			var _objectHandle = null;

			// Release handles on previous object, if any.
			if (this._handles) {
				dojoArray.forEach(this._handles, function (handle, i) {
					mx.data.unsubscribe(handle);
				});
				this._handles = [];
			}

			// When a mendix object exists create subscribtions.
			if (this._contextObj) {
				_objectHandle = this.subscribe({
					guid: this._contextObj.getGuid(),
					callback: dojoLang.hitch(this, function (guid) {
						this._updateRendering();
					})
				});


				this._handles = [_objectHandle];
			}

		},
		_createChart: function (container, configuration) {
			logger.debug(this.id + "_createChart");
			var that = {};
			var config = {

				ringInset: 25,

				pointerWidth: 10,
				pointerTailLength: 2,
				pointerHeadLengthPercent: 0.9,

				minAngle: -90,
				maxAngle: 90,
				// 20190828 - Changed format for v4 from ',g' to '.3'								
				labelFormat: d3.format('.3'),
				labelInset: 10,

				arcGradientColor: true,

				arcColorFn: function (value) {
					for (var i = 0; i < config.areas.length; i++) {
						if (value <= config.areas[i].end && value >= config.areas[i].start) {
							return config.areas[i].color;
						}
					}
					return "#ffffff";
				}
			};

			var range,
				r,
				pointerHeadLength,
				svg,
				arc,
				scale,
				pointer;
			var ticks = [];
			var ticks2 = [];
			var tickData = [];
			var ratios = [];


			function deg2rad(deg) {
				return deg * Math.PI / 180;
			}

			function configure(configuration) {
				var prop;
				for (prop in configuration) {
					config[prop] = configuration[prop];
				}

				range = config.maxAngle - config.minAngle;
				r = config.size / 2;
				pointerHeadLength = Math.round(r * config.pointerHeadLengthPercent);

				// a linear scale that maps domain values to a percent from 0..1
				// 20190828 - Fix for moving to D3 v4: https://stackoverflow.com/questions/35953892/d3-scale-linear-vs-d3-scalelinear
				scale = d3.scaleLinear().domain([config.minValue, config.maxValue])
					.range([0, 1]);

				// build up angles 
				var rangeOriginal = (config.maxValue - config.minValue);
				for (var j = 0; j < config.areas.length; j++) {
					if (j === 0) {
						ticks.push((config.areas[j].start) * rangeOriginal);
					}
					ticks.push((config.areas[j].end) * rangeOriginal);

				}
				//build up ticks
				//2018-05-02 - Ivo Sturm - using a dummy ticks2 array to create ticks independent of the angles. This is needed to cater for scenario of non-zero starting value
				for (j = 0; j < config.areas.length; j++) {
					if (j === 0) {
						ticks2.push(config.minValue + ((config.areas[j].start) * rangeOriginal));
					}
					ticks2.push(config.minValue + ((config.areas[j].end) * rangeOriginal));

				}

				// build tickData and ratios based on ticks
				for (var k = 0; k < ticks.length; k++) {
					ratios.push(ticks[k] / rangeOriginal);
					if (k > 0) {
						tickData.push((ticks[k] - ticks[k - 1]) / rangeOriginal);
					}

				}

				// 20190828 - Fix for moving to D3 v4: https://stackoverflow.com/questions/35953892/d3-scale-linear-vs-d3-scalelinear 
				arc = d3.arc()
					.innerRadius(r - config.ringWidth - config.ringInset)
					.outerRadius(r - config.ringInset)
					.startAngle(function (d, i) {

						var ratio = ratios[i];

						return deg2rad(config.minAngle + (ratio * range) + config.tickBorder);
					})
					.endAngle(function (d, i) {

						var ratio = ratios[i + 1];

						return deg2rad(config.minAngle + (ratio * range) - config.tickBorder);
					});
			}
			that.configure = configure;

			function centerTranslation() {
				return 'translate(' + r + ',' + r + ')';
			}
			function pointerCreator(deg, len, radius) {
				var thetaRad = deg2rad(deg / 2);

				var centerX = 0;
				var centerY = 0;

				var topX = centerX - len * Math.cos(thetaRad);
				var topY = centerY - len * Math.sin(thetaRad);

				var leftX = centerX - radius * Math.cos(thetaRad - Math.PI / 2);
				var leftY = centerY - radius * Math.sin(thetaRad - Math.PI / 2);

				var rightX = centerX - radius * Math.cos(thetaRad + Math.PI / 2);
				var rightY = centerY - radius * Math.sin(thetaRad + Math.PI / 2);

				return "M " + leftX + " " + leftY + " L " + topX + " " + topY + " L " + rightX + " " + rightY;

			}
			function isRendered() {
				return (svg !== undefined);
			}
			that.isRendered = isRendered;

			function render(newValue, textColor, pointerColor, easing) {
				svg = d3.select(container)
					.append('svg:svg')
					.attr('class', 'gauge')
					.attr('width', config.clipWidth)
					.attr('height', config.clipHeight * (2 / 3));

				var centerTx = centerTranslation();

				var arcs = svg.append('g')
					.attr('class', 'arc')
					.attr('transform', centerTx)
					.style('cursor', 'pointer');

				// generate gradient color if set from modeler
				if (config.arcGradientColor) {
					for (var j = 0; j < config.areas.length; j++) {
						var gradient = svg.append('defs')
							.append('linearGradient')
							.attr('id', 'c-chart-gauge__gradient_' + j);

						gradient
							.append('stop')
							.attr('offset', '0%')
							.attr('stop-color', config.areas[j].color);

						if (j == config.areas.length - 1) {
							gradient
								.append('stop')
								.attr('offset', '0%')
								.attr('stop-color', config.areas[j].color);
						} else {
							gradient
								.append('stop')
								.attr('offset', '100%')
								.attr('stop-color', config.areas[j + 1].color);
						}
					}

					arcs.selectAll('path')
						.data(tickData)
						.enter().append('path')
						.attr('d', arc)
						.attr("fill", function (d, i) { return "url(#c-chart-gauge__gradient_" + i + ")"; });
				}
				// else use set color
				else {
					arcs.selectAll('path')
						.data(tickData)
						.enter().append('path')
						.attr('fill', function (d, i) {
							return config.areas[i].color;
						})
						.attr('d', arc);
				}

				var lg = svg.append('g')
					.attr('class', 'label')
					.attr('transform', centerTx);
				lg.selectAll('text')
					.data(ticks2)
					.enter().append('text')
					.attr('transform', function (d) {
						var ratio = scale(d);
						var newAngle = config.minAngle + (ratio * range);
						return 'rotate(' + newAngle + ') translate(0,' + (config.labelInset - r) + ')';
					})
					.style('fill', textColor)
					.text(config.labelFormat);

				var lineData = [[config.pointerWidth / 2, 0],
				[0, -pointerHeadLength],
				[-(config.pointerWidth / 2), 0],
				[0, config.pointerTailLength],
				[config.pointerWidth / 2, 0]];


				var pointerLine = pointerCreator(180, config.needleLength, config.needleRadius);
				var pg = svg.append('g').data([lineData])
					.attr('class', 'pointer')
					.attr('transform', centerTx)
					.style('fill', pointerColor);

				pg.append('circle')
					.attr('class', 'needle-center')
					.attr('cx', 0)
					.attr('cy', 0)
					.attr('r', config.needleRadius);

				pointer = pg.append('path')
					.attr('d', pointerLine)
					.attr('transform', 'rotate(' + config.minAngle + ')');

				update(newValue === undefined ? 0 : newValue, config, easing);
			}
			that.render = render;

			function update(newValue, newConfiguration, easing) {
				if (newConfiguration !== undefined) {
					configure(newConfiguration);
				}
				var ratio = scale(newValue);
				var newAngle = config.minAngle + (ratio * range);
				pointer.transition()
					.duration(config.transitionMs)
					.ease(easing)
					.attr('transform', 'rotate(' + newAngle + ')');
			}
			that.update = update;

			configure(configuration);

			return that;
		},
		_roundWithPrecision: function (value, precision) {
			var multiplier = Math.pow(10, precision || 0);
			return Math.round(value * multiplier) / multiplier;
		},
		_execMf: function (mf, guid, cb) {

			if (mf && guid) {
				this._progressID = mx.ui.showProgress();
				mx.data.action({
					params: {
						applyto: "selection",
						actionname: mf,
						guids: [guid]
					},
					origin: this.mxform,
					callback: dojoLang.hitch(this, function (obj) {
						if (cb && typeof cb === "function") {
							cb(obj);
						}
						this.hideProgress();
					}),
					error: dojoLang.hitch(this, function (error) {
						this.hideProgress();
						console.debug(error.description);
					})
				}, this);
			}
		},
		hideProgress: function () {
			if (this._progressID) {
				mx.ui.hideProgress(this._progressID);
				this._progressID = null;
			}
		}

	});
});

require(["D3Gauge/widget/D3Gauge"], function () {
	"use strict";
});
