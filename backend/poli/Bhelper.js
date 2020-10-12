common
   moduleByName
op-move
   moveEntry
rt-rec
   applyRtDelta
-----
selfMovingFunc ::= function () {
    $.moveEntry(
        $$,
        'selfMovingFunc',
        $$.name === 'Ahelper' ? $.moduleByName('Bhelper') : $.moduleByName('Ahelper'),
        true
    )
    // $.applyRtDelta();
}
