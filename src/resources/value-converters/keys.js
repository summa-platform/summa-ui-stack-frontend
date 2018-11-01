
export class KeysValueConverter {
	toView(obj) {
		if(!obj)
			return [];
		return Object.keys(obj);
	}
}
