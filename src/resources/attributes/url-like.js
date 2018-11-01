import {inject} from 'aurelia-framework';
import {Router} from 'aurelia-router';
import log from 'logger';

@inject(Element, Router)
export class UrlLikeCustomAttribute {

  constructor(element, router) {
    this.element = element;
	this.router = router;
	this._onClick = this.onClick.bind(this);
	this.element.style.cursor = 'pointer';
  }

  attached() {
	  this.element.addEventListener('click', this._onClick);
  }

  detached() {
	  this.element.removeEventListener('click', this._onClick);
  }

  onClick() {
	  let href = this.element.attributes.href.value;
	  log.debug('Url-like: navigate to:', href);
	  this.router.navigate(href);
  }

  valueChanged(newValue, oldValue) {
  }
}

