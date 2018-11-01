import {bindable} from 'aurelia-framework';

export class CollectionsBookmark {
	@bindable model = { color: '#ffffff' };

	activate(model) {
		this.model = model;
	}
}
