// from: https://gist.run/?id=acf8253329939b2e046cd0e3394351fe
import {bindingMode, observable} from 'aurelia-binding';
import {bindable} from 'aurelia-templating';
import {inject} from 'aurelia-dependency-injection';
import {DOM} from 'aurelia-pal';
import {containerless} from 'aurelia-framework';

let nextID = 0;

@containerless()
@inject(Element)
export class Autocomplete {
	@bindable service;
	@bindable({ defaultBindingMode: bindingMode.twoWay }) value;
	@bindable placeholder = '';
	@bindable delay = 250;
	id = nextID++;
	expanded = false;
	@observable inputValue = '';
	updatingInput = false;
	suggestions = [];
	index = -1;
	suggestionsUL = null;
	userInput = '';
	@bindable ulClass;
	@bindable liClass;
	@bindable ulCss;
	@bindable liCss;
	
	constructor(element) {
		this.element = element;
	}

	attached() {
		this.inputStyle = this.element.getAttribute('style');
		this.inputClass = this.element.getAttribute('class');
	}
	
	display(name) {
		this.updatingInput = true;
		this.inputValue = name;
		this.updatingInput = false;
	}
	
	getName(suggestion) {
		if (suggestion == null) {
			return '';
		}
		return this.service.getName(suggestion);
	}
	
	collapse() {
		this.expanded = false;
		this.index = -1;
	}
	
	select(suggestion, notify) {
		this.selectionUserInput = this.userInput;
		this.value = suggestion;
		const name = this.getName(this.value);
		this.userInput = name;
		this.display(name);
		this.collapse();
		if (notify) {
			const event = DOM.createCustomEvent('change', { bubbles: true });
			event.value = suggestion;
			event.autocomplete = this;
			this.element.dispatchEvent(event);
		}
	}
	
	valueChanged() {
		this.select(this.value, false);
	}
	
	inputValueChanged(value) {
		if (this.updatingInput) {
			return;
		}
		this.userInput = value;
		if (value === '') {
			this.value = null;
			this.collapse();
			return;
		}
		this.service.suggest(value)
			.then(suggestions => {
				this.index = -1;
				this.suggestions.splice(0, this.suggestions.length, ...suggestions);
				if (suggestions.length === 1 && suggestions[0] !== this.value) {
					this.select(suggestions[0], true);
				} else if (suggestions.length === 0) {
					this.collapse();
				} else {
					this.expanded = true;
					this.index = 0;	// select first suggestion: the text itself
				}
			});
	}
	
	scroll() {
		const ul = this.suggestionsUL;
		const li = ul.children.item(this.index === -1 ? 0 : this.index);
		if (li.offsetTop + li.offsetHeight > ul.offsetHeight + ul.scrollTop) {
			ul.scrollTop = li.offsetTop + li.offsetHeight - ul.offsetHeight;
		} else if(li.offsetTop < ul.scrollTop) {
			ul.scrollTop = li.offsetTop;
		}
	}
	
	keydown(key) {
		if (!this.expanded) {
			if (key === 13) {
				let value = this.inputElement.value;

				this.value = value;
				this.sendEvent('select', value); // send select event
				return;

				// this.value = value;
				if (this.value && value === this.selectionUserInput || this.index !== -1) {
					// this.sendEvent('enter', this.value); // send enter event
					this.sendEvent('select', this.value); // send select event
				}
				return true;
			}
			return true;
		}
		
		// down
		if (key === 40) {
			if (this.index < this.suggestions.length - 1) {
				this.index++;
				this.display(this.getName(this.suggestions[this.index]));
			} else {
				this.index = -1;
				this.display(this.userInput);
			} 
			this.scroll();
			return;
		}
		
		// up
		if (key === 38) {
			if (this.index === -1) {
				this.index = this.suggestions.length - 1;
				this.display(this.getName(this.suggestions[this.index]));
			} else if (this.index > 0) {
				this.index--;
				this.display(this.getName(this.suggestions[this.index]));
			} else {
				this.index = -1;
				this.display(this.userInput);
			}
			this.scroll();
			return;  
		}
		
		// escape
		if (key === 27) {
			this.display(this.userInput);
			this.collapse();
			return;
		}
		
		// enter
		if (key === 13) {
			if (this.index >= 0) {
				let suggestion = this.suggestions[this.index];
				if(this.service.getName(suggestion) === this.inputElement.value) {
					this.select(this.suggestions[this.index], true);
					// this.sendEvent('enter', suggestion); // send enter event
					this.sendEvent('select', suggestion); // send select event
				}
			}
			return;
		}
		
		return true;
	}

	sendEvent(name, suggestion) {
		const event = DOM.createCustomEvent(name, { bubbles: true });
		event.value = suggestion;
		event.autocomplete = this;
		this.element.dispatchEvent(event);
	}
	
	blur() {
		this.select(this.value, false);
		this.element.dispatchEvent(DOM.createCustomEvent('blur'));
	}
	
	suggestionClicked(suggestion) {
		this.select(suggestion, true);
		this.sendEvent('select', suggestion); // send select event
		this.selectionUserInput = this.inputElement.value;
	}
	
	focus() {
		this.element.firstElementChild.focus();
	}
}

// aria-activedescendant
// https://webaccessibility.withgoogle.com/unit?unit=6&lesson=13
// https://www.w3.org/TR/wai-aria/states_and_properties#aria-autocomplete
// https://www.w3.org/TR/wai-aria/roles#combobox
