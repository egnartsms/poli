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
dedb-functional
	* as: functional
dedb-rec-key
	recKey
	recVal
-----
clsRelation ::= ({
   name: 'relation',
   'relation': true
})
isStatefulRelation ::= function (rel) {
	return $.isA(rel, $.clsBaseRelation, $.clsDerivedRelation);
}
info2rel ::= new WeakMap
toRelation ::= function (relDescriptor) {
	if (typeof relDescriptor.class === 'object' && $.isA(relDescriptor, $.clsRelation)) {
		// $.toRelation is idempotent
		return relDescriptor;
	}

	let relation = $.info2rel.get(relDescriptor);

	if (relation !== undefined) {
		return relation;
	}

	let relInfo = typeof relDescriptor === 'function' ? relDescriptor() : relDescriptor;

	if (relInfo.body !== undefined) {
		relation = $.derived.makeRelation(relInfo);
	}
	else if (relInfo.instantiations !== undefined) {
		relation = $.functional.makeRelation(relInfo);
	}
	else {
		relation = $.base.makeRelation(relInfo);
	}

	$.info2rel.set(relDescriptor, relation);

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
