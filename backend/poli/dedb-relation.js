dedb-base
	makeRelation as: makeBaseRelation
dedb-derived
	makeRelation as: makeDerivedRelation
-----
RelationType ::= ({
   base: 'base',
   derived: 'derived',
   functional: 'functional'
})
info2rel ::= new WeakMap
getRelation ::= function (relInfo) {
	let relation = $.info2rel.get(relInfo);

	if (relation === undefined) {
		if (relInfo.body !== undefined) {
			relation = $.makeDerivedRelation(relInfo);
		}
		else {
			relation = $.makeBaseRelation(relInfo);
		}

		$.info2rel.set(relInfo, relation);
	}
	
	return relation;
}
clearRelationCache ::= function () {
	$.info2rel = new WeakMap();
}
keyedProto ::= ({
	isKeyed: true,
	rec2key([recKey, recVal]) {
		return recKey;
	},
	rec2val([recKey, recVal]) {
		return recVal;
	}
})
nonkeyedProto ::= ({
	isKeyed: false,
	rec2key(rec) {
		return rec;
	},
	rec2val(rec) {
		return rec;
	}
})
getRelevantProto ::= function (isKeyed) {
	return isKeyed ? $.keyedProto : $.nonkeyedProto;
}
