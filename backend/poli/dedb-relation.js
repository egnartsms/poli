common
	isA
dedb-base
	* as: base
	clsBaseRelation
dedb-derived
	* as: derived
	clsDerivedRelation
	clsDerivedProjection
-----
clsRelation ::= ({
   name: 'relation',
   'relation': true
})
info2rel ::= new WeakMap
toRelation ::= function (relInfo) {
	if (typeof relInfo.class === 'object' && relInfo.class['relation'] === true) {
		return relInfo;
	}

	let relation = $.info2rel.get(relInfo);

	if (relation === undefined) {
		if (relInfo.body !== undefined) {
			relation = $.derived.makeRelation(relInfo);
		}
		else {
			relation = $.base.makeRelation(relInfo);
		}

		$.info2rel.set(relInfo, relation);
	}
	
	return relation;
}
clearRelationCache ::= function () {
	$.info2rel = new WeakMap();
}
recKeyBindingMakesSenseFor ::= function (rel) {
	return (
		$.isA(rel, $.clsBaseRelation) ||
		$.isA(rel, $.clsDerivedRelation) && rel.isKeyed
	);
}
