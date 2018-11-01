import {inject, bindable} from 'aurelia-framework';

export class Icon {
	@bindable glyphicon;
	@bindable svgicon;
	@bindable active;
	model = { color: '#ffffff' };

	constructor() {
	}

	activeChanged(active) {
		if(active) {
			this.model.color = '#9dc3f7';
		} else {
			this.model.color = '#ffffff';
		}
	}
}
