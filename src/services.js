import {inject, noView} from 'aurelia-framework';
import log from 'logger';
import {CompositionService} from 'composition-service';
import {Store} from 'store';


@noView
@inject(CompositionService, Store)
export class Services {

	constructor(compositionService, store) {
		this.compositionService = compositionService;
		this.store = store;
	}

	async newQuery() {
		let [dialog, destroy] = await this.compositionService.create('dialogs/query-settings-dialog');
		let query = await dialog.viewModel.new({ feedGroups: [] });
		destroy();

		if(query) {
			log.debug('New query yet to be stored:', query);
			query = await this.store.addQuery(query);
			log.debug('Stored query:', query);
		}

		return query;
	}
}
