import {bindable} from 'aurelia-framework';

export class AltIcon {
	@bindable model = { color: '#ffffff' };
	@bindable width = '100%';
	@bindable height = '100%';

	activate(model) {
		this.model = model;
	}
}
