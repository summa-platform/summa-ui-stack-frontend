import { inject } from 'aurelia-framework';
import { Store } from 'store';

@inject(Store)
export class BookmarkSettingsDialog {

	constructor(store) {
		this.store = store;
		this.store.getBookmarkTypes().then(bookmarkTypes => { this.bookmarkTypes = bookmarkTypes });
	}

	async check(query, validate, resolve) {
		if(!validate) {
			resolve(query);
			return;
		}
		let result = await validate();
		if(result.valid) {
			resolve(query);
		}
	}
}
