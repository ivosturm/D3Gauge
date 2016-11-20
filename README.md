# D3Gauge
Description

Add a fancy customizable gauge chart based on the D3 library to your application. Features include: full formatting of the arc and needle, including color coding of different sections of the gauge, animating the way the pointer behaves, adding a microflow on click of the gauge and rounding of values;

Typical usage scenario

When reporting needs to be presented in a Mendix application for some key progress indicator.

Features and limitations

Features:

Formatting of Arc
Color coding sections of the gauge
Formatting of Needle
Animating the needle
Adding an on click microflow

Limitations:
Fully sopported is a 180 degrees arc. 270 or 360 degrees arcs are not supported. 
The chart is created as SVG, hence the feedback widget (HTML2Canvas library) can not grab this image.


Configuration

Step 1: Create a non-persistent GaugeWrapper entity in which at least three Decimal type attributes should be present: Value, MinValue and MaxValue. 
Step 2: Add a dataview to your page, populated by a datasource microflow that creates this GaugeWrapper entity.
Step 3: Configure the widget

General Settings
Chart Title: The title that will be displayed inside the arch
Text Color: The color being used in the title, ticks and display value
Size: The size of the gauge
Value: The value the needle will be pointing at
Display value: Decide whether the value will be displayed inside the arc or not.
Rounding: Whether the decimal Value should be rounded to integer level (via Math.round)
Minimum Value: Minimum value for the arc of the gauge
Maximum Value: Maximum value for the arc of the gauge

Arc
Color Gauge Sections: Set colors per sections of the gauge. Irrelevant of what minimum and maximum value are set, stick to a percentage from 0 to 100 here.
Range Start: The starting percentage of this section of the gauge
Range End: The ending percentage of this section of the gauge
Color: The color for the section. Example colors: Red: #F02828, Orange: #FE6A00, Yellow: #E8DD11, Lightgreen: #82E042, Green: #089F50
Sections Border: The size of the whitespace to appear next to each Gauge Section / Tick. 0 is none, default 1
Ring Width: The width of the arc sections

Needle
Needle Color: The color being used to fill the Needle
Needle Length: The length of the Needle
Neede Radius: The radius of the circle to appear at the bottom of the Needle

Animation:
Easing: Determines which animation will be shown for the Needle at drawing of the Gauge. See http://bl.ocks.org/hunzy/9929724 for explanation.
Easing Duration: The duration of the animation in ms. So, 1000 is 1 second.

Interaction:
Microflow: The microflow to execute on click




