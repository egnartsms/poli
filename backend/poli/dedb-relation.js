common
	assert
	isA
data-structures
	ExpRecords
	ImpRecords
dedb-base
	* as: base
	clsBaseRelation
dedb-derived
	* as: derived
	clsDerivedRelation
	clsDerivedProjection
dedb-rec-key
	recKey
	recVal
-----
clsRelation ::= ({
   name: 'relation',
   'relation': true
})
info2rel ::= new WeakMap
toRelation ::= function (relInfo) {
	if (typeof relInfo.class === 'object' && relInfo.class['relation'] === true) {
		// $.toRelation is idempotent
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
accessorForAttr ::= function (rel, attr) {
	$.assert(() => rel.logAttrs.includes($.recVal));

	if (attr === $.recKey) {
		if (rel.isKeyed) {
			return ([rkey, rval]) => rkey;
		}
		else {
			return (rec) => rec;
		}
	}

	if (attr === $.recVal) {
		$.assert(() => rel.isKeyed);

		return ([rkey, rval]) => rval;
	}

	if (isKeyed) {
		return ([rkey, rval]) => rval[attr];
	}
	else {
		return (rec) => rec[attr];
	}
}
recordCollection ::= function (owner) {
	return owner.isKeyed ? $.ExpRecords : $.ImpRecords;
}
rec2pair ::= function (owner, rec) {
	return owner.isKeyed ? rec : [rec, rec];
}
rec2pairFn ::= function (owner) {
	return owner.isKeyed ? (rec => rec) : (rec => [rec, rec]);
}
rec2key ::= function (owner, rec) {
	return owner.isKeyed ? rec[0] : rec;
}
rec2keyFn ::= function (owner) {
	return owner.isKeyed ? (([rkey, rval]) => rkey) : (rec => rec);
}
rec2val ::= function (owner, rec) {
	return owner.isKeyed ? rec[1] : rec;
}
rec2valFn ::= function (owner) {
	return owner.isKeyed ? (([rkey, rval]) => rval) : (rec => rec);
}
pair2rec ::= function (owner, rkey, rval) {
	if (owner.isKeyed) {
		return [rkey, rval];
	}
	else {
		$.assert(() => rkey === rval);
		return rkey;
	}
}
