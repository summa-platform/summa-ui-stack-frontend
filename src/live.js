import {inject, bindable, observable, bindingMode} from 'aurelia-framework';
import log from 'logger';
import {Store} from 'store';
import {CompositionService} from 'composition-service';
import {Router, Redirect} from 'aurelia-router';
import {Services} from 'services';
import moment from 'moment';

function isRelativeTag(str) {
	if(!str) {
		return false;
	}
	if(str == 'now') {
		return true;
	}
	let validateRE = /\s*(?:-|\+)?\s*(?:(?:\d+(?:.\d+)?)\s*(?:ns|us|µs|ms|s|m|h|y|w|M|mo|d)\s*)+/g;
	if(str.match(validateRE)) {
		return true;
	}
	return false;
}

function relativeDate(str, relativeTo) {
	let validateRE = /\s*-?\s*(?:(?:\d+(?:.\d+)?)\s*(?:ns|us|µs|ms|s|m|h|y|w|M|mo|d)\s*)+/g;
	if(!str.match(validateRE)) {
		throw 'invalid duration string: '+str;
	}
	let signPrefixRE = /^\s*-/g;
	let sign = str.match(signPrefixRE) ? -1 : 1;
	let partRE = /(\d+(?:.\d+)?)\s*(ns|us|µs|ms|s|m|h|y|w|M|mo|d)/g;
	let date, match;
	let validUnits = ['ms','s','m','h','y','w','M','mo','d'];
	let skipUnits = ['us','µs','ns'];
	if(!relativeTo) {
		date = moment(new Date());
	} else if(relativeTo instanceof Date) {
		date = moment(relativeTo);	// TODO: check if instance of moment instead
	} else {
		date = relativeTo;
	}
	while((match = partRE.exec(str)) != null) {
		let v = match[1];
		let unit = match[2];
		if(unit == 'mo') {
			unit = 'M';
		// } else if(unit == 'us' || unit == 'µs' || unit == 'ns') {
		} else if(skipUnits.indexOf(unit) != -1) {
			continue;
		} else if(validUnits.indexOf(unit) == -1) {
			throw 'invalid unit: '+unit;
			// continue;
		}
		date = date.add(sign*v, unit);
	}
	return date;
}

const dateTimeTagDefault = 'now';

@inject(Store, CompositionService, Router, Services)
export class Live {

	@observable feeds = [];
	@observable params = [];

	@bindable dateTimeTag = dateTimeTagDefault;
	@bindable dateTimeString;	// NOTE: setting values here led to conflicts with restoring state

	constructor(store, compositionService, router, services) {
		this.store = store;
		this.compositionService = compositionService;
		this.router = router;
		this.services = services;

		// prevent Chrome/Safari browser navigation with swipe left/right on mac
		// or it will interfere with timeline horizontal scrolling
		document.addEventListener('mousewheel', (e) => {
			if(Math.abs(e.deltaX) > Math.abs(e.deltaY) || Math.abs(e.deltaX) > 0) {
				e.preventDefault();
			  }
		}, {passive: false});
	}
	
	activate(params, routeConfig) {
		this.params = params;	// will trigger changed handler, have to do it this way, because of Aurelia bug (had to move key parts to attached handler, which runs only once)
	}

	async attached() {
		// should be in activate(), however does not correctly there, because route was not correctly set up at that point, so navigate does not work correctly from activate
		this.dateTimeTagPresetValues = jQuery(this.dateTimeTagElement).children('option').map((i, v) => v.value).toArray();
		await this.paramsChanged();
		await this.fetch();			// changed handlers do not fire at this point, so execute fetch manually
	}

	async paramsChanged() {
		if(this.params.dateTime) {
			if(isRelativeTag(this.params.dateTime)) {
				this.dateTimeTag = this.params.dateTime;	// relative time tag
			} else {
				// absolute timestamp
				this.dateTimeTag = 'date-time';
				let date = moment(new Date(this.params.dateTime*1000));
				this.dateTimeString = date.format('YYYY-MM-DD HH:mm:ss');
			}
		} else {
			this.dateTimeTag = dateTimeTagDefault;
		}
	}

	async selectItem(id, event) {
		const params = {
			mediaItemID: id
		};
		let url = '#/trending/media-items/:mediaItemID';
		for(const param of Object.keys(params)) {
			let re = new RegExp(':'+param, 'g');
			url = url.replace(re, params[param])
		}
		if(this.services.altTouch || event.altKey || event.ctrlKey || event.shiftKey || event.metaKey) {
			window.open(url, '_blank');
		} else {
			window.location.href = url;
		}
	}

	async dateTimeTagChanged(value, oldValue) {
		if((value == 'date-time') && (oldValue != 'date-time' && oldValue != 'date-time-')) {
			let date = relativeDate(oldValue);
			this.dateTimeString = date.format('YYYY-MM-DD HH:mm:ss');
		} else {
			await this.fetch();
		}
	}

	async dateTimeStringChanged(dateTime) {
		await this.fetch();
	}

	async fetch() {
		let dt = this.dateTimeTag == 'date-time' ? +moment(this.dateTimeString)/1000 : this.dateTimeTag;
		this.store.getLiveFeedsData(dt).then(feeds => {
			// this.feeds = feeds;
			Array.prototype.splice.apply(this.feeds, [0, feeds.length].concat(feeds));
		});
		this.router.navigateToRoute('live', { dateTime: dt }, { trigger: false });
	}
}
