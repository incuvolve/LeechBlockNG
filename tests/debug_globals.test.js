test('minimal function global test A', () => {
    require('/tmp/test_a.js');
    console.log('testFuncA type:', typeof global.testFuncA);
    expect(true).toBe(true);
});
test('minimal function global test B (with leading const)', () => {
    require('/tmp/test_b.js');
    console.log('testFuncB type:', typeof global.testFuncB);
    console.log('SOME_CONST:', global.SOME_CONST);
    expect(true).toBe(true);
});
