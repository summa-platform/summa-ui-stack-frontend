
export class UserSettingsDialog {

	async check(user, validate, resolve) {
		let result = await validate();
		if(result.valid) {
			resolve(user);
		}
	}
}
