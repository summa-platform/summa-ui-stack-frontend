
export class QuerySettingsDialog {

	async check(query, validate, resolve) {
		let result = await validate();
		if(result.valid) {
			resolve(query);
		}
	}
}
