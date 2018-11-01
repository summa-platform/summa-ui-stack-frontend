
import * as d3 from 'd3';

// inspired by/parts from: https://github.com/jiahuang/d3-timeline

function D3Timeline() {

	let hourlyFormat = d3.utcFormat("%Y-%m-%d %H:%M");
	let minuteFormat = d3.utcFormat("%H:%M");
	let fullFormat = d3.utcFormat("%Y-%m-%d %H:%M:%S");

	this.tickFormat = function (date) {
		if(date.getUTCMinutes() == 0) {
			return hourlyFormat(date);
		}
		return minuteFormat(date);
	}

	this.margin = { left: 30, right: 30, top: 30 + 10*18, bottom: 30 };

	this.hover = function () {};
	this.mouseover = function () {};
	this.mouseout = function () {};
	this.click = function () {};
	this.scroll = function () {};

	let self = this;

	function d3axis(orient) {
		return d3['axis'+orient[0].toUpperCase()+orient.substr(1)];
	}

	this.width = 4000;

	this.draw = function (parent, selected_time, onclick) {

		let margin = self.margin;

		let itemHeight = 18,
			itemMargin = 5,
			width = null,
			height = null,
			orient = "bottom",
			showAxisTop = false,
			stacked = false,
			colorPropertyName = null,
			colorCycle = (x) => d3.schemeCategory10[x % d3.schemeCategory10.length],
			showTodayFormat = {marginTop: 25, marginBottom: 0, width: 1, color: 'gray'}
			;

		parent.selectAll('g').data(['container']).enter().append('g');
		let container = parent.select('g');
		let parentParentNode = parent.node().parentNode;
		let parentSize = parentParentNode.getBoundingClientRect();

		self.parent = parent;
		let data = parent.datum();

		// add background color filter
		parent.selectAll('defs').data(['filter-def']).enter().append('defs').html(`
			<filter x="0" y="0" width="1" height="1" id="text-background">
				<feComposite in="SourceGraphic" in2="BackgroundImage" operator="over" result="comp"/>
			</filter>
		`);

		let beginning, ending;

		for(let row of data) {
			if(row.length > 0) {
				if(row[0].range_start && (!beginning || row[0].range_start < beginning)) {
					beginning = row[0].range_start;
				}
				if(row[0].starting_time && (!beginning || row[0].starting_time < beginning)) {
					beginning = row[0].starting_time;
				}
				if(row[row.length-1].range_end && (!ending || row[row.length-1].range_end > ending)) {
					ending = row[row.length-1].range_end;
				}
				if(row[row.length-1].ending_time && (!ending || row[row.length-1].ending_time > ending)) {
					ending = row[row.length-1].ending_time;
				}
			}
		}

		if(!beginning || !ending) {
			return;
		}

		let yAxisMapping = {};
		let maxStack = 1;
		yAxisMapping[0] = 0;

		setWidth();
		self.width = width;


		let scaleFactor = (1/(ending - beginning)) * (width - margin.left - margin.right);

		// draw the axis
		var xScale = d3.scaleTime()
			.domain([beginning, ending])
			.range([margin.left, width - margin.right]);

		var xAxis = d3.axisBottom(xScale).tickFormat(self.tickFormat).ticks(d3.timeMinute.every(5));


		let rows = container.selectAll('g.row').data(data);

		rows.exit().remove();
		rows.enter().append('g').attr('class', 'row');


		let zip = rows => rows[0].map((_,c) => rows.map(row => row[c]));

		function getStackPosition(d, i) {
			if(stacked) {
				return margin.top + (itemHeight + itemMargin) * yAxisMapping[index];
			}
			return margin.top;
		}

		function getStackTextPosition(d, i) {
			if(stacked) {
				return margin.top + (itemHeight + itemMargin) * yAxisMapping[index] + itemHeight * 0.75;
			}
			return margin.top + itemHeight * 0.75 - itemHeight - 10*itemHeight;
		}

		function getXPos(d, i) {
			return margin.left + (d.starting_time - beginning) * scaleFactor;
		}

		function getXTextPos(d, i) {
			return margin.left + (d.starting_time - beginning) * scaleFactor + 5;
		}


		container.selectAll('g.row').each(function (data, row_index) {

			let g = d3.select(this);

			let items = g.selectAll('g.item').data(data);

			items.exit().remove();

			items = items.enter().append('g').attr('class', 'item').attr("pointer-events", "bounding-box");

			items.append('rect');
			items.append('text').attr('class', 'keywords');

			items = g.selectAll('g.item');

			items.on("click", function (d, i) {
				self.click(d, row_index, data);
			});

			items.selectAll('rect')
				.attr("x", getXPos)
				.attr("y", getStackPosition)
				.attr("width", function (d, i) {
					return (d.ending_time - d.starting_time) * scaleFactor;
				})
				.attr("cy", function(d, i) {
						return getStackPosition(d, i) + itemHeight/2;
				})
				.attr("cx", getXPos)
				.attr("r", itemHeight / 2)
				.attr("height", itemHeight)
				.style("fill", function(d, i){
					let dColorPropName;
					if(d.color) return d.color;
					if(colorPropertyName){
						dColorPropName = d[colorPropertyName];
						if(dColorPropName) {
							return colorCycle(dColorPropName);
						} else {
							return colorCycle(datum[colorPropertyName]);
						}
					}
					return colorCycle(row_index);
				})
				.on("mousemove", function (d, i) {
					self.hover(d, i, data);
				})
				.on("mouseover", function (d, i) {
					self.mouseover(d, i, data);
				})
				.on("mouseout", function (d, i) {
					self.mouseout(d, i, data);
				})
				.on("click", function (d, i) {
				  self.click(d, i, data);
					// click(d, index, datum);
				})
				;

			// keywords
			items.selectAll("text")
				.attr("class", "item-keywords")
				.attr("x", getXTextPos)
				.attr("y", getStackTextPosition)
				// .attr("y", getStackTextPosition)
				// .selectAll("tspan")
				// .data(function (item) { return zip([item.keywords, item.weights]).reverse(); }).enter().append("tspan");
				.each(function (d, i) {
					let tspans = d3.select(this).selectAll('tspan').data(zip([d.keywords, d.weights]).reverse())
					;
					// .enter().append("tspan")
					tspans = tspans.enter().append("tspan")
						// constants
						.attr("dy", "1.2em")
						.merge(tspans)  // may be too slow, if so, create another selection instead
					;
					// tspans = d3.select(this).selectAll('tspan');

					tspans
						// .attr("fill", "rgb(0,0,1)")
						.attr("fill-opacity", (d) => d[1]*15)
						.attr("x", (dd,ii) => getXTextPos(d, i))
						.text(function (d,z) { return d[0]; })
						// .text(d.label)
					;
				})
				;

		});

		function appendTimeAxis(g, xAxis, yPosition) {
			g.append("g")
				.attr("class", "axis")
				.attr("transform", "translate(" + 0 + "," + yPosition + ")")
				.call(xAxis);
		};

		var belowLastItem = (margin.top + (itemHeight + itemMargin) * maxStack);
		var aboveFirstItem = margin.top;
		var timeAxisYPosition = showAxisTop ? aboveFirstItem : belowLastItem;
		appendTimeAxis(container, xAxis, timeAxisYPosition);

		let zoom;

		if (width > parentSize.width) {
			let move = function() {
				const transform = d3.event.transform;
				parentSize = parentParentNode.getBoundingClientRect();
				if(zoom.extent()()[1][0] != parentSize.width) {
					zoom.extent([[0, 0], [parentSize.width, 0]]);
				}
				let x = Math.min(0, Math.max(parentSize.width - width, transform.x));
				container.attr("transform", "translate(" + transform.x + "," + transform.y + ")");
				self.scroll(x*scaleFactor, xScale);
			};

			// https://stackoverflow.com/questions/47583932/d3-zoom-x-domain-only
			// http://emptypipes.org/2016/07/03/d3-panning-and-zooming/
			zoom = d3.zoom()
				.extent([[0, 0], [parentSize.width, 0]])
				.scaleExtent([1, 1])	// ok
				.translateExtent([[0, 0], [width, 0]])
				.on("zoom", move);

			let s = d3.select(parent.node().parentNode)
				.on('wheel', () => {
					if(Math.abs(d3.event.wheelDeltaY || d3.event.deltaY) > Math.abs(d3.event.wheelDeltaX || d3.event.deltaX)) {
						// ignore vertical wheel
						return;
					}
					if((d3.event.wheelDeltaY || d3.event.deltaY) != 0) {
						return;
					}
					d3.event.preventDefault();
					d3.event.stopPropagation();
					let delta = d3.event.wheelDelta || -d3.event.deltaX*5;
					if(delta == undefined) return;
					let x = ((container.node().transform.baseVal.length || container.node().transform.baseVal.numberOfItems) > 0)
						? (container.node().transform.baseVal.getItem(0).matrix.e) : 0;
					x += delta;
					parentSize = parentParentNode.getBoundingClientRect();
					if(x > 0) {
						x = 0;
					} else if(x < parentSize.width - width) {
						x = parentSize.width - width;
					}
					s.call(zoom.transform, d3.zoomIdentity.translate(x, 0))
				})
				.call(zoom)
				;
		}

		var containerSize = container.node().getBoundingClientRect();

		setHeight();

		if (selected_time) {
			let selected = margin.left + (selected_time - beginning) * scaleFactor;
			let lineFormat = showTodayFormat;
			container.selectAll('line.center').data(['center']).enter().append('line')
				.attr('class', 'center')
				.attr("y1", lineFormat.marginTop)
				.attr("y2", height - lineFormat.marginBottom)
				.style("stroke", lineFormat.color)//"rgb(6,120,155)")
				.style("stroke-width", lineFormat.width);
			container.select('line.center')
				.attr("x1", selected)
				.attr("x2", selected);

			container.selectAll('text.center').data(['center']).enter().append('text')
				.attr('class', 'center')
				.attr('text-anchor', 'middle')
				.attr('dy', 14)
				.style('font-size', 12)
				.style('font-weight', 'bold')
				.attr('y', height - lineFormat.marginBottom);
			container.select('text.center')
				.attr('x', selected)
				.text(fullFormat(selected_time));

			// scroll to selected line
			if(isFinite(selected) && zoom) {
				let x = -selected + parentSize.width/2;
				if(x > 0) {
					x = 0;
					} else if(x < parentSize.width - width) {
						x = parentSize.width - width;
				}
				d3.select(parent.node().parentNode)
					.call(zoom.transform, d3.zoomIdentity.translate(x, 0));
			}
		}

		function setWidth() {
			if (!width && !parentSize.width) {
				try {
					width = parent.attr("width");
					// if(!width) {
					// 	throw "width of the timeline is not set. As of Firefox 27, timeline().with(x) needs to be explicitly set in order to render";
					// }
				} catch(err) {
					console.log(err);
				}
			} else if(!(width && parentSize.width)) {
				try {
					width = parent.attr("width");
				} catch(err) {
					console.log(err);
				}
			}
			// if both are set, do nothing
		}

		function setHeight() {
			if(!height && !parent.attr("height")) {
				if(itemHeight) {
					// set height based off of item height
					height = containerSize.height + containerSize.top - parentSize.top;
					// set bounding rectangle height
					d3.select(parent.node()).attr("height", height);
					// d3.select(gParent[0][0]).attr("height", height);
				} else {
					throw "height of the timeline is not set";
				}
			} else {
				if(!height) {
					height = parent.attr("height");
				} else {
					parent.attr("height", height);
				}
			}
		}
	}
}

export default D3Timeline;
