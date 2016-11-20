/*global logger */
/*
    D3 GaugeChart
    ========================

    @file      : D3Gauge.js
    @version   : 1.0.0
    @author    : Ivo Sturm
    @date      : 20-11-2016
    @copyright : First Consulting
    @license   : Apache 2

    Documentation
    ========================
    Add a gauge chart based on the D3 library to your application. Features include: full formatting of the arc and needle, including color coding of different sections in the gauge,
	animating the way the pointer behaves, adding a microflow on click of the gauge and rounding of values;
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
    "D3Gauge/lib/d3-v2-min"
], function(declare, _WidgetBase, _TemplatedMixin, dom, dojoDom, on, dojoStyle, dojoArray, dojoLang, dojoText, widgetTemplate, d3) {
    "use strict";
	var d3 = window.d3;
    // Declare widget's prototype.
    return declare("D3Gauge.widget.D3Gauge", [ _WidgetBase, _TemplatedMixin ], {
        // _TemplatedMixin will create our dom node using this HTML template.
        templateString: widgetTemplate,

        // DOM elements
        d3Gauge: null,

        // Internal variables. Non-primitives created in the prototype are shared between all widget instances.
        _handles: null,
        _contextObj: null,
		_progressID: null,

        // dojo.declare.constructor is called to construct the widget instance. Implement to initialize non-primitive properties.
        constructor: function() {

            logger.debug(this.id + ".constructor");
            this._handles = [];
        },

        // dijit._WidgetBase.postCreate is called after constructing the widget. Implement to do extra setup work.
        postCreate: function() {
            logger.debug(this.id + ".postCreate");
			this.hideProgress();

            
        },

        // mxui.widget._WidgetBase.update is called when context is changed or initialized. Implement to re-render and / or fetch data.
        update: function(obj, callback) {
            logger.debug(this.id + ".update");
			this.hideProgress();
            this._contextObj = obj;
			var objGuid = this._contextObj ? this._contextObj.getGuid() : null;
			
			if (this.onClickMF){
				this._setupEvents(objGuid);
			}
            this._resetSubscriptions();
            this._updateRendering();

            if (typeof callback !== "undefined") {
              callback();
            }
        },

        // mxui.widget._WidgetBase.uninitialize is called when the widget is destroyed. Implement to do special tear-down work.
        uninitialize: function() {
          logger.debug(this.id + ".uninitialize");
            // Clean up listeners, helper objects, etc. There is no need to remove listeners added with this.connect / this.subscribe / this.own.
			this.hideProgress();

        },

        // Attach events to HTML dom elements
        _setupEvents: function(objGuid) {
			
            logger.debug(this.id + "._setupEvents");

			on(this.d3Gauge,'click', dojo.hitch(this, function(e) {
				this._execMf(this.onClickMF, objGuid);
			}));
        },


        _drawChart: function() {
			logger.debug(this.id + "._drawChart");

			// Widget configured variables
			var value = this._contextObj ? Number(this._contextObj.get(this.valueAttr)) : 0;
			var minValue = this._contextObj ? Number(this._contextObj.get(this.minValueAttr)) : 0;
			var maxValue = this._contextObj ? Number(this._contextObj.get(this.maxValueAttr)) : 100;
			this.range = maxValue - minValue;
			

			// truncate when over the maximum or under the minimum
			if(value >= maxValue){
				value = maxValue;
			} else if(value <= minValue) {
				value = minValue;
			}
			
			if (this.rounding){
				value = this._roundWithPrecision(value,0);
			}
			// Build up array with the sections in it. Will be used in rendering the gauge sections via d3 later on.
			var colorArr = this.colorArray;
			
			if (colorArr.length > 0){
				this.areaArray = [];

				for (var i = 0; i < colorArr.length; i++){
					var areaObj = {
						start : (colorArr[i].rangeStart / 100),
						end : (colorArr[i].rangeEnd / 100),
						color : colorArr[i].colorSection
					};
					this.areaArray.push(areaObj);				
				}
				this.noTicks = colorArr.length ;
				
				// always sort the array on the rangeEnd attribute. Will help if not put in right order in the Modeler.
				this.areaArray.sort(function(a, b) {
					return parseFloat(a.end) - parseFloat(b.end);
				});
			}
		
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
				needleLength: this.needleLength
			};
			// Create the chart.
			var powerGauge = this._createChart(this.d3Gauge, config);
			
			// Set the pointer to it's value with some added easing
			powerGauge.render(value,this.textColor,this.pointerColor,this.easing);
			
			// Hide the value in the bottom of the pointer, if set in the Modeler.
			if (this.displayValue){
				var pointer = d3.select(".pointer");		
				pointer.append("text")
					.attr('id', "Value")
					.attr("font-size",20)
					.attr("text-anchor","middle")
					.attr("dy","1.5em")
					.style('fill', this.textColor)
					.text(value);
			}
			// Set the chart title.
			var gauge = d3.select(".gauge");
			gauge.append("text")
                .attr('id', "Value")
                .attr("font-size",20)
                .attr("text-anchor","top")
                .attr("dy","-1.5em")
				.attr("dx","5em")
                .style('fill', this.textColor)
				.text(this.chartTitle);
        },

        // Rerender the interface.
        _updateRendering: function() {
            logger.debug(this.id + "._updateRendering");

            // Draw or reload.
            if (this._contextObj !== null) {
              this._drawChart();
            } else {
                dojoStyle.set(this.domNode, "display", "none"); // Hide widget dom node.
            }

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
		_createChart : function(container, configuration) {
			
				var that = {};
				var config = {

					ringInset					: 25,

					pointerWidth				: 10,
					pointerTailLength			: 2,
					pointerHeadLengthPercent	: 0.9,
									
					minAngle					: -90,
					maxAngle					: 90,
														
					labelFormat					: d3.format(',g'),
					labelInset					: 10,
										
					arcColorFn: function(value){
						for(var i=0;i<config.areas.length;i++){
							if(value <= config.areas[i].end && value >= config.areas[i].start){
								return config.areas[i].color;
							}
						}
						return "#ffffff";
					}
				};

				var range = undefined;
				var r = undefined;
				var pointerHeadLength = undefined;
			
				var svg = undefined;
				var arc = undefined;
				var scale = undefined;
				var ticks = [];
				var tickData = [];
				var ratios = [];
				var pointer = undefined;
				
				function deg2rad(deg) {
					return deg * Math.PI / 180;
				}
								
				function configure(configuration) {
					var prop = undefined;
					for ( prop in configuration ) {
						config[prop] = configuration[prop];
					}
					
					range = config.maxAngle - config.minAngle;
					r = config.size / 2;
					pointerHeadLength = Math.round(r * config.pointerHeadLengthPercent);

					// a linear scale that maps domain values to a percent from 0..1
					scale = d3.scale.linear()
						.range([0,1])
						.domain([config.minValue, config.maxValue]);
				
					// build up ticks 
					var rangeOriginal = (config.maxValue - config.minValue);
					for (var j = 0 ; j < config.areas.length ; j++){
						if (j === 0){
							ticks.push((config.areas[j].start) * rangeOriginal  );
						} 
						ticks.push((config.areas[j].end) * rangeOriginal );						
					}
			
					// build tickData and ratios based on ticks
					for (var k = 0 ; k < ticks.length ; k++){
						ratios.push(ticks[k] / rangeOriginal);
						if (k > 0){
							tickData.push((ticks[k] - ticks[k-1]) / rangeOriginal);
						} 
								
					}
					
					arc = d3.svg.arc()
						.innerRadius(r - config.ringWidth - config.ringInset)
						.outerRadius(r - config.ringInset)
						.startAngle(function(d, i) {

							var ratio = ratios[i];

							return deg2rad(config.minAngle + (ratio * range) + config.tickBorder);
						})
						.endAngle(function(d, i) {

							var ratio = ratios[i+1];

							return deg2rad(config.minAngle + (ratio * range) - config.tickBorder);
						});
				}
				that.configure = configure;
				
				function centerTranslation() {
					return 'translate('+r +','+ r +')';
				}
				function pointerCreator(deg,len,radius){
					var thetaRad = deg2rad(deg / 2 );

					var centerX = 0;
					var centerY = 0;

					var topX = centerX - len * Math.cos(thetaRad);
					var topY = centerY - len * Math.sin(thetaRad);

					var leftX = centerX - radius * Math.cos(thetaRad - Math.PI / 2);
					var leftY = centerY - radius * Math.sin(thetaRad - Math.PI / 2);

					var rightX = centerX - radius * Math.cos(thetaRad + Math.PI / 2);
					var rightY = centerY - radius * Math.sin(thetaRad + Math.PI / 2);

					return "M " + leftX  + " " + leftY + " L " + topX + " " + topY + " L " + rightX + " " + rightY;

				}
				function isRendered() {
					return (svg !== undefined);
				}
				that.isRendered = isRendered;
				
				function render(newValue,textColor,pointerColor,easing) {
					svg = d3.select(container)
						.append('svg:svg')
							.attr('class', 'gauge')
							.attr('width', config.clipWidth)
							.attr('height', config.clipHeight);
					
					var centerTx = centerTranslation();
					
					var arcs = svg.append('g')
							.attr('class', 'arc')
							.attr('transform', centerTx)
							.style('cursor', 'pointer');
					
					arcs.selectAll('path')
							.data(tickData)
						.enter().append('path')
							.attr('fill', function(d, i) {
								return config.areas[i].color;
							})
							.attr('d', arc);
					
					var lg = svg.append('g')
							.attr('class', 'label')
							.attr('transform', centerTx);	
					lg.selectAll('text')
							.data(ticks)
						.enter().append('text')
							.attr('transform', function(d) {
								var ratio = scale(d);
								var newAngle = config.minAngle + (ratio * range);
								return 'rotate(' +newAngle +') translate(0,' +(config.labelInset - r) +')';
							})
							.style('fill', textColor)
							.text(config.labelFormat);

					var lineData = [ [config.pointerWidth / 2, 0], 
									[0, -pointerHeadLength],
									[-(config.pointerWidth / 2), 0],
									[0, config.pointerTailLength],
									[config.pointerWidth / 2, 0] ];
					

					var pointerLine = pointerCreator(180,config.needleLength,config.needleRadius);
					var pg = svg.append('g').data([lineData])
							.attr('class', 'pointer')
							.attr('transform', centerTx)
							.style('fill', pointerColor);
							
					pg.append('circle')
					  .attr('class', 'needle-center')
					  .attr('cx', 0)
					  .attr('cy', 0)
					  .attr('r', config.needleRadius)							
							
					pointer = pg.append('path')
						.attr('d', pointerLine)
						.attr('transform', 'rotate(' +config.minAngle +')');
						
					update(newValue === undefined ? 0 : newValue,config,easing);
				}
				that.render = render;
				
				function update(newValue, newConfiguration,easing) {
					if ( newConfiguration  !== undefined) {
						configure(newConfiguration);
					}
					var ratio = scale(newValue);
					var newAngle = config.minAngle + (ratio * range);
					pointer.transition()
						.duration(config.transitionMs)
						.ease(easing)
						.attr('transform', 'rotate(' +newAngle +')');
				}
				that.update = update;

				configure(configuration);
				
				return that;
			},
			_roundWithPrecision : function (value, precision) {
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
						store: {
							caller: this.mxform
						},
						callback: dojoLang.hitch(this, function (obj) {
							if (cb && typeof cb === "function") {
								cb(obj);
							}
							this.hideProgress();
						}),
						error: dojoLang.hitch(this,function (error) {
							this.hideProgress();
							console.debug(error.description);
						})
					}, this);
				}
			},
			hideProgress : function(){
				if (this._progressID) {
				mx.ui.hideProgress(this._progressID);
					this._progressID = null;
				}
			}

    });
});

require(["D3Gauge/widget/D3Gauge"], function() {
    "use strict";
});