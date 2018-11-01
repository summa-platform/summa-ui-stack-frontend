// from: http://stackoverflow.com/a/38461893
// usage: <input type="password" enter-press.call="signIn()"/>
import {customAttribute, inject} from 'aurelia-framework';

@customAttribute('enter-press')
@inject(Element)
export class EnterPress {
	element: Element;
	value: Function;
	enterPressed: (e: KeyboardEvent) => void;

	constructor(element) {
		this.element = element;

		this.enterPressed = e => {
			let key = e.which || e.keyCode;
			if (key === 13) {
				this.value();//'this' won't be changed so you have access to you VM properties in 'called' method
			}
		};
	}

	attached() {
		this.element.addEventListener('keypress', this.enterPressed);
	}

	detached() {
		this.element.removeEventListener('keypress', this.enterPressed);
	}
}
