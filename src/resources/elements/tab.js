import {bindable, observable, inject} from 'aurelia-framework';
import {Tabset} from './tabset';

@inject(Tabset, Element)
export class Tab {
	@bindable header;
	@bindable disabled = false;
	@bindable onSelect;
	@bindable onDeselect;
	@bindable route;

	index;
	@observable active = false;

	constructor(tabset, element) {
		this.tabset = tabset;
		this.element = element;
	}

	bind() {
		if(!this.header)
			throw new Error('Must provide a header for the tab.');
	}

	attached() {
		this.$tabPane = this.element.querySelector('.tab-pane');
		this.$tabPane.style.display = this.active ? 'block' : 'none';
	}

	activeChanged(active) {
		if(this.$tabPane)
			this.$tabPane.style.display = this.active ? 'block' : 'none';
	}

	handleTabChanged(index) {
	}
}
