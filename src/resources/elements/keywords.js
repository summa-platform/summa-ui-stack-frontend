import {bindable, observable, bindingMode, children} from 'aurelia-framework';
import log from 'logger';

export class Keywords {
	@bindable items;
	@children('span') spans;
	@bindable animate = false;

	constructor() {
	}

	attached() {
		// for(let span of this.spans) {
		// 	span.addClass('au-animate');
		// }
	}

	itemsChanged(items) {
		setTimeout(() => this.animate = true);
	}

	remove(index) {
		this.items.splice(index, 1);
	}
	// remove(item) {
	// 	this.items.splice(this.items.indexOf(item), 1);
	// }
}
