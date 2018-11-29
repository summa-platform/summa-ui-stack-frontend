import {inject, bindable} from 'aurelia-framework';
import * as d3 from 'd3';
import $ from 'jquery';
import log from 'logger';


@inject(Element)
export class Clustering {
	@bindable clusters;
	@bindable height = '100%';
	@bindable width = '100%';
	@bindable select;

	minFontSize = "8px";
	maxFontSize = "24px";

	isAttached = false;

	constructor(element) {

		this.element = element;

		this.treemap = d3.treemap()
			.size([100, 100])
			.tile(d3.treemapBinary)
			//.tile(d3.treemapSquarify.ratio(1))
			.round(true)
			.paddingInner(0);
	}

	attached() {
      	this.container = d3.select(this.element).select(".clustering-container");

		this.isAttached = true;
		this.draw(this.clusters);
		
		window.addEventListener('resize', this.onResize.bind(this));
	}

	detached() {
		window.removeEventListener('resize', this.onResize.bind(this));
	}

	clustersChanged(data) {
		if(this.isAttached) {
			this.draw(data);
		}
	}

	onResize() {
		$(this.container.node()).find(".clustering-cell").each((i, e) => {
			this.resizeText($(e));
		});
	}

	resizeText(clusteringcell) {
		var reduceby = 0.9; // percent

		var temp_div = $("<div />").addClass("clustering-text").appendTo(clusteringcell);

		var text = clusteringcell.text();
		temp_div.text(text);
		temp_div.css("width", clusteringcell.css("width"));
		temp_div.css("height", "auto");

		var heigth = clusteringcell.innerHeight() * reduceby;
		var textHeight = 0;

		var maxFontSize = parseInt(this.maxFontSize, 10);
		var unit = this.maxFontSize.replace(maxFontSize.toString(), "");
		var minFontSize = parseInt(this.minFontSize, 10);
		var fontSize = minFontSize;
		while (fontSize <= maxFontSize && textHeight < heigth) {
			temp_div.css('font-size', fontSize + unit);
			temp_div.css('line-height', fontSize + unit);
			fontSize++;

			textHeight = temp_div.innerHeight();
		}

		clusteringcell.css('font-size', Math.max(fontSize - 1, minFontSize) + unit);
		clusteringcell.css('line-height', Math.max(fontSize - 1, minFontSize) + unit);

		temp_div.remove();
	}

	draw(data) {
		log.debug('CLUSTER DATA:', data);
		if(!data) {
			return;
		}
		this.container.selectAll("div").remove();
		if(!data || data.length == 0) {
			return;
		}

		let topics = [];
		let id = 0;
		for(let topic of data) {
			let topicClusters = [];
			for(let cluster of topic.clusters) {
				topicClusters.push({
					id: id++,
					name: topic.id,
					image: "",
					cluster_id: cluster.id,
					parent: null,
					title: cluster.title,
					value: cluster.size,
					color: "color_" + (topic.size % 10),
				});
			}
			topics.push({
				id: id++,
				children: topicClusters,
				value: 0, // topic.size,
				name: topic.topic,
			});
		}

		data = {
			name: "root",
			// cluster_id: null,
			// parent: null,
			children: topics,
		};
		log.debug('CLUSTER DATA AUGMENTED:', data);
		
		var root = d3.hierarchy(data)
			.sum(function (d) { return d.value; })
			.sort(function (a, b) { return b.height - a.height || b.value - a.value; });
			//.eachBefore(function (d) { d.data.id = (d.parent ? d.parent.data.id + "." : "") + d.data.name; });
		log.debug("ROOT:", root)

		this.treemap(root);

		let topicLastNodeID = {};
		for(let node of root.leaves()) {
			let id = node.data.id;
			let topic = node.parent.data.name;
			let last = topicLastNodeID[topic];
			if(!last || last.node.x1 + last.node.y1 < node.x1 + node.y1) {
				topicLastNodeID[topic] = { id, node };
			}
		}

		let clicked = false;

		var cell = this.container.selectAll("div")
			.data(root.leaves())
			.enter().append("div")
			// .attr("parent-name", function (d) { return d.parent.data.name; })
			// .attr("parent-name", function (d) { return d.parent.data.name; })
			// .attr("node-id", function (d) { return d.data.id; })
			.on("mouseenter", function () {
				this.classList.add("hover");
			})
			.on("mouseleave", function () {
				this.classList.remove("hover");
			})
			.on("click", function (node) {
				if(self.select && !clicked) {
					const event = d3.event;
					clicked = true;
					d3.event.stopImmediatePropagation();
					d3.event.stopPropagation();
					d3.event.preventDefault();
					setTimeout(() => {
						self.select({ $cluster: node.data.cluster_id, $evt: event });
						clicked = false;
					}, 100);
				}
			});
		cell.attr("class", function (d) { return "clustering-cell cell_" + d.data.name; })
			.style("left", function (d) { return "calc(" + d.x0 + "% + 1px)"; })
			.style("top", function (d) { return "calc(" + d.y0 + "% + 1px)"; })
			.style("width", function (d) { return "calc(" + (d.x1 - d.x0) + "% - 2px)"; })
			.style("height", function (d) { return "calc(" + (d.y1 - d.y0) + "% - 2px)"; })
			.attr("title", function (d) { return "Storyline "+d.data.cluster_id+": \n"+d.data.title; })
			.each(function (node, i, g) {
				if(topicLastNodeID[node.parent.data.name].id == node.data.id) {
					$(this).addClass('last');
				}
			});

		cell.append("div")
			.attr("class", "cluster-name")
			.text(function (d) { return d.parent.data.name; })
			.on("click", function (d) {
				// scope.$emit("cluster-name-clicked", d.data);
				d3.event.preventDefault();
				d3.event.stopPropagation();
			})

		var image = cell.append("div")
			.attr("class", "clustering-image");

		var text = cell.append("div")
			.attr("class", function (d) {
				var color = d.data.color || null;
				var p = d;
				while (color == null && p) {
					if (p.data.color)
						color = p.data.color;
					p = p.parent;
				}
				// return "clustering-text " + color + " loading";
				return "clustering-text " + color;
			})
			.text(function (d, v, e) {
				return d.data.title;
			});

		let self = this;
		cell.each(function (node, i, g) {
			let element = $(this);
			self.resizeText(element);
			// let x = element.css('font-size');
			// let y = element.css('line-height');
		});



		// legacy code

		// cluster images in angularjs
		/*
		if (this.watchText)
			this.watchText();
		this.watchText = scope.$watchGroup(root.leaves().map(function (f) {
			return function () { return f.data.title };
		}), (newval, oldval) => {
			newval.forEach((f, i) => {
				if (f != oldval[i]) {
					var cell = instanceElement.find(".cell_" + root.leaves()[i].data.name);
					var textelement = cell.find(".clustering-text");
					textelement.text(f);
					textelement.removeClass("loading");
					this.resizeText(cell);
				}
			})
		});

		if (this.watchImages)
			this.watchImages();
		this.watchImages = scope.$watchGroup(root.leaves().map(function (f) {
			return function () { return f.data.image };
		}), (newval, oldval) => {
			newval.forEach((f, i) => {
				if (f != oldval[i]) {
					var cell = instanceElement.find(".cell_" + root.leaves()[i].data.name);
					cell.addClass("with-image");
					var imageelement = cell.find(".clustering-image");
					imageelement.css("background-image", "url(" + f + ")");
				}
			})
		});
		*/


		// cluster image animations in angularjs
		/*
		var animations = ["up", "down", "left", "right"];
		var interval = setInterval(function () {
			var cell_with_images = instanceElement.find(".with-image");
			var visible = cell_with_images.filter(":not(.text-hidden)");
			var hidden = cell_with_images.filter(".text-hidden");
			if (hidden.length) {
				var n = Math.floor(Math.random() * hidden.length);
				for (var i = 0; i < n; i++) {
					var idx = Math.floor(Math.random() * hidden.length);
					hidden[idx].classList.remove("text-hidden");
					animations.forEach(function (f) {
						hidden[idx].classList.remove(f);
					});
				}
			}

			if (visible.length) {
				var n = Math.random() > 0.5 ? 3 : 6;
				for (var i = 0; i < n; i++) {
					var idx = Math.floor(Math.random() * visible.length);
					visible[idx].classList.add("text-hidden");

					var anim = animations[Math.floor(Math.random() * animations.length)];
					visible[idx].classList.add(anim);
				}
			}
		}, 3000);
		*/
	}
}
