import {children, bindable, bindingMode, inject, useShadowDOM, containerless} from 'aurelia-framework';
import {Router} from 'aurelia-router';
import {EventAggregator} from 'aurelia-event-aggregator';

@inject(Router, EventAggregator)
// @children({ name: "tabs", selector: "routed-tab" })
// @children({ name: "tabs", selector: "*" })
// @useShadowDOM
// @containerless
export class Tabset {
	// @bindable type = bootstrapOptions.tabsetType;
	// @bindable vertical = bootstrapOptions.tabsetVertical;
	@bindable({defaultBindingMode: bindingMode.twoWay}) active = 0;
	// @children({ selector: "routed-tab" }) tabs;
	@children('tab') tabs;
	@bindable({defaultBindingMode: bindingMode.twoWay}) headerStyle = 0;
	@bindable({defaultBindingMode: bindingMode.twoWay}) contentStyle = 0;

	tabsClass = 'nav-tabs';

	constructor(router, events) {
		this.router = router;
		this.events = events;
	}

	selectTabHeader(route) {
		// if(!this.tabs)
		// 	return;
		// for(let t of this.tabs) {
		// 	t.active = t.route === route;
		// }
	}

	attached() {
		if(this.tabs)
		this.selectTab(this.tabs[0]);
	}

	tabsChanged() {
		if(this.tabs)
		this.selectTab(this.tabs[0]);
	}

	detached() {
	}

	selectTab(tab, force = false) {
		for(let t of this.tabs) {
			t.active = t === tab;
		}
	}
}
