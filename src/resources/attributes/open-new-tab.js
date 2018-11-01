import {customAttribute, inject} from 'aurelia-framework';

@customAttribute('open-new-tab')
@inject(Element)
export class OpenNewTab {
	value;

	constructor(element) {
		element.onclick = () => {
			if(this.value)
				window.open(element.attributes.href.nodeValue, '_blank')
			else
				window.location.href = element.attributes.href.nodeValue;
		}
		// element.onclick = () => window.open(element.attributes.href.nodeValue || this.value, '_blank');
	}
}
