common
   moduleByName
op-move
   moveEntry
rt-rec
   applyRtDelta
-----
partner ::= 'partner'
anotherPartner ::= 'ap'
selfMovingFunc ::= function () {
    $.moveEntry(
        $$,
        'selfMovingFunc',
        $$.name === 'Ahelper' ? $.moduleByName('Bhelper') : $.moduleByName('Ahelper'),
        true
    )
    $.applyRtDelta();
}
