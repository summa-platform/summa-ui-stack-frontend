import {inject, bindable, observable, bindingMode, containerless} from 'aurelia-framework';
import $ from 'bootstrap';
import log from 'logger';

export class Modal {
	@bindable({defaultBindingMode: bindingMode.oneWayOut}) dialog;
	@bindable options = { keyboard: true };
	@bindable model = {};
	@bindable title;
	@bindable({defaultBindingMode: bindingMode.oneTime}) autoOpen = false;
	@bindable({defaultBindingMode: bindingMode.oneWayOut}) open;

	constructor() {
		this.dialog = this;
		this.open = this.__open.bind(this);	// workaround function binding limitation
	}

	__open(model, options) {
		if(model) {
			this.model = model;
		}
		if(this.modal) {
			this.modal.modal('show');
		} else {
			let options = Object.assign({}, this.options, options || {});
			this.modal = $(this.element)
				.modal(this.options)
				.on('hidden.bs.modal', () => {
				// http://stackoverflow.com/questions/13177426/how-to-destroy-bootstrap-modal-window-completely
				// $(this).data('bs.modal', null);
				if(this.modal) {
					// in some cases detached will happen first, that also means the element is destroyed anyway
					this.modal.data('bs.modal', null);
				}
				if(this.resolve) {
					this.resolve();		// by default resolve with undefined value unresolved promise
					// this.reject();
				}
				// clean-up
				this.resolve = undefined;
				this.reject = undefined;
			});
		}
		return new Promise((resolve, reject) => {
			// this.resolve = resolve;
			// this.reject = reject;
			this.resolve = (...args) => {
				this.hide();
				resolve(...args);
			};
			this.reject = (...args) => {
				this.hide();
				reject(...args);
			};
		});
	}

	show() {
		if(this.modal) {
			this.modal.modal('show');
		} else {
			throw new Error('show() should be called only after activate()')
		}
	}

	hide() {
		if(this.modal) {
			this.modal.modal('hide');
		} else {
			throw new Error('hide() should be called only after activate()')
		}
	}

	destroy() {
		if(this.modal) {
			this.modal.modal('hide');
		} else {
			throw new Error('destroy() should be called only after activate()')
		}
	}

	attached() {
		if(this.autoOpen) {
			this.open();
		}
	}

	detached() {
		if(this.resolve) {
			this.resolve();	// probably not needed, but just in case...
		}
		this.resolve = undefined;
		this.reject = undefined;
		this.modal = undefined;
	}

	close(...args) {
		this.resolve(...args);
	}

	// ok(...args) {
	// 	// log.debug('modal ok');
	// 	this.resolve(...args);
	// 	this.modal.modal('hide');
	// }
}

