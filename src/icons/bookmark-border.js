import {bindable} from 'aurelia-framework';

export class BookmarkBorder {
	@bindable model = { color: '#ffffff' };
	@bindable width = '100%';
	@bindable height = '100%';

	activate(model) {
		this.model = model;
	}
}
