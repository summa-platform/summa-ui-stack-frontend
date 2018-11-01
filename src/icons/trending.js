import {bindable} from 'aurelia-framework';

export class Trending {
	@bindable model = { color: '#ffffff' };

	activate(model) {
		this.model = model;
	}
}
