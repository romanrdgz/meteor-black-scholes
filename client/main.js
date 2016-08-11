import { Mongo } from 'meteor/mongo';
import { Template } from 'meteor/templating';

import './main.html';
import '../imports/api/black-scholes.js';
import Dataseries from '../imports/api/data/dataseries.js';

Template.body.onCreated(function(){
	// Initialization
	Session.set("curr_price", 0);
	Session.set("curr_iv", 0);
	Session.set("curr_r", 0.27);
	Session.set("nearTermOptStrike", 0);
	Session.set("nearTermOptExpiry", 0);
	Session.set("nearTermOptRight", "");
	Session.set("nextTermOptStrike", 0);
	Session.set("nextTermOptExpiry", 0);
	Session.set("nextTermOptRight", "");
	
	Dataseries.insert({_id: "x_values", data: range(0, 20, 201)})
	Dataseries.insert({_id: "y_var_t_values", data: Array.from({length: 201}, () => 0)})
	Dataseries.insert({_id: "y_exp_values", data: Array.from({length: 201}, () => 0)})
});

Template.body.events({
	'change .parameters-form'(event) { //TODO no tengo claro que el evento sea submit al no haber boton
		// Prevent default browser form submit
		event.preventDefault();
		
		var value = event.target.value
		// Update value if not empty and if it has changed
		if(value != null && value != ""){
			switch(event.target.name){
				case "current-price-input":
					if(!Session.equals("curr_price", value)){
						Session.set("curr_price", value);
						// Update x values to cover 15% at each side of current underlying price
						Dataseries.update({_id: "x_values"}, {$set: {data: range(value*0.85, value*1.15, 201)}})
					}
					break;
				case "current-iv-input":
					if(!Session.equals("curr_iv", value)){
						Session.set("curr_iv", value);
					}
					break;
				case "current-r-input":
					if(!Session.equals("curr_r", value)){
						Session.set("curr_r", value);
					}
					break;
				case "near-term-opt-strike":
					if(!Session.equals("nearTermOptStrike", value)){
						Session.set("nearTermOptStrike", value);
					}
					break;
				case "near-term-opt-expiry":
					if(!Session.equals("nearTermOptExpiry", value)){
						Session.set("nearTermOptExpiry", value);
					}
					break;
				case "near-term-opt-right":
					if(!Session.equals("nearTermOptRight", value)){
						Session.set("nearTermOptRight", value);
					}
					break;
				case "next-term-opt-strike":
					if(!Session.equals("nextTermOptStrike", value)){
						Session.set("nextTermOptStrike", value);
					}
					break;
				case "next-term-opt-expiry":
					if(!Session.equals("nextTermOptExpiry", value)){
						Session.set("nextTermOptExpiry", value);
					}
					break;
				case "next-term-opt-right":
					if(!Session.equals("nextTermOptRight", value)){
						Session.set("nextTermOptRight", value);
					}
					break;
				default:
					// Should not ever get here
					break;
			}
		}
		
		// Assign values
		this.curr_price = Session.get("curr_price");
		this.curr_iv = Session.get("curr_iv");
		this.curr_r = Session.get("curr_r");
		this.nearTermOptStrike = Session.get("nearTermOptStrike");
		this.nearTermOptExpiry = Session.get("nearTermOptExpiry");
		this.nearTermOptRight = Session.get("nearTermOptRight");
		this.nextTermOptStrike = Session.get("nextTermOptStrike");
		this.nextTermOptExpiry = Session.get("nextTermOptExpiry");
		this.nextTermOptRight = Session.get("nextTermOptRight");
		
		// Check that all the data has been filled
		if(this.curr_price && this.curr_iv && this.curr_r && this.nearTermOptStrike && this.nearTermOptExpiry &&
		   this.nearTermOptRight && this.nextTermOptStrike && this.nextTermOptExpiry && this.nextTermOptRight){
			console.log("all data has been filled");

			// Update options list
			var options = []
			options.push(new Option(this.nearTermOptStrike, this.nearTermOptExpiry, this.nearTermOptRight, this.curr_price))
			options.push(new Option(this.nextTermOptStrike, this.nextTermOptExpiry, this.nextTermOptRight, this.curr_price))
			
			// Update dates list
			var dates = []
			dates.push(new Date()); // Today
			dates.push(this.nearTermOptExpiry);

			// Get each curve, recalculate its values, and update into the collection
			for(plot_date in this.dates){
				y_values = []
				for(x in x_values){
					opt_sum = 0
					for(opt in options){
						var t = daydiff(expiry, plot_date) / 251 // (251 trading days per year)
						opt_sum += blackScholes(this.curr_price, opt.strike, t, this.curr_iv, this.curr_r, opt.right);
					}
					y_values.push(opt_sum)
				}
				
				console.log("Y: " + y_values);
				
				// Update the curves
				if(this.nearTermOptExpiry == plot_date){
					// Update expiration curve
					Dataseries.update({_id: "y_exp_values"}, {$set: {data: y_values}})
				} 
				else{
				Dataseries.update({_id: "y_var_t_values"}, {$set: {data: y_values}})
				}
			}
		}
	},
});

Template.chart.onRendered(function() {
	var myData = [];
	var chart;
	this.autorun(function () {
		myData = [
			{
			  values: [{x: Dataseries.find({_id: "x_values"}, {data: 1}).fetch()[0].data, y: Dataseries.find({_id: "y_var_t_values"}, {data: 1}).fetch()[0].data}],
			  key: 'Today',
			  color: '#ff7f0e'
			},
			{
			  values: [{x: Dataseries.find({_id: "x_values"}, {data: 1}).fetch()[0].data, y: Dataseries.find({_id: "y_exp_values"}, {data: 1}).fetch()[0].data}],
			  key: 'At expiration',
			  color: '#2ca02c'
			}
		];
		
		console.log(Dataseries.find({_id: "x_values"}, {data: 1}).fetch()[0].data)
		console.log(Dataseries.find({_id: "y_var_t_values"}, {data: 1}).fetch()[0].data)
		
		if(chart != undefined){
			d3.select('#riskGraph svg')
			  .datum(myData)
			  .call(chart);
			chart.update();
		}
	});
	
	nv.addGraph(function() {
	  chart = nv.models.lineChart()
					.margin({left: 100}) 			//Adjust chart margins to give the x-axis some breathing room.
					.useInteractiveGuideline(true)  //We want nice looking tooltips and a guideline!
					.showLegend(true)       		//Show the legend, allowing users to turn on/off line series.
					.showYAxis(true)        		//Show the y-axis
					.showXAxis(true);    		    //Show the x-axis

	  chart.xAxis     //Chart x-axis settings
		  .axisLabel('Underlying')
		  .tickFormat(d3.format(',r'));

	  chart.yAxis     //Chart y-axis settings
		  .axisLabel('P/L')
		  .tickFormat(d3.format('.02f'));

	  //Select the <svg> element you want to render the chart in and populate with data
	  d3.select('#riskGraph svg')
		  .datum(myData)
		  .call(chart);

	  //Update the chart when window resizes.
	  nv.utils.windowResize(function() { chart.update() });
	  return chart;
	});
});


function range(start, stop, n) {
    if (typeof stop == 'undefined') {
        // one param defined
        stop = start;
        start = 0;
    }

    if (typeof step == 'undefined') {
        step = 1;
    }

    if ((step > 0 && start >= stop) || (step < 0 && start <= stop)) {
        return [];
    }

    var result = [];
	step = (stop - start) / (n-1);
    for (var i = start; step > 0 ? i < stop : i > stop; i += step) {
        result.push(i);
    }

    return result;
}

function daydiff(first, second) {
    return Math.round((second-first)/(1000*60*60*24));
}
