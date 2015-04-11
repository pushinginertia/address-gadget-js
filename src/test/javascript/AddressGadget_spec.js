describe('AddressGadget', function() {
    describe('doCallback', function() {
        var callbacks = null;

        beforeEach(function() {
            callbacks = {
                fn: function(a, b) {
                }
            };
            spyOn(callbacks, 'fn').andCallThrough();
        });

        it('tests doCallback for a function that exists', function() {
            AddressGadget.prototype.doCallback(
                callbacks,
                'fn',
                'X',
                'Y'
            );

            expect(callbacks.fn).toHaveBeenCalled();
            expect(callbacks.fn.calls.length).toEqual(1);
            expect(callbacks.fn).toHaveBeenCalledWith('X', 'Y');
        });

        it('tests doCallback for a function that does not exist', function() {
            AddressGadget.prototype.doCallback(
                callbacks,
                'xxfn',
                'X',
                'Y'
            );
            expect(callbacks.fn).not.toHaveBeenCalled();
        });
    });
});

function lookupPostalCode(gc, postalCode, expectedAddr) {
}

describe('AddressGadgetGMap', function() {
    it('tests that Google Maps dependency exists', function() {
        expect(google.maps.Geocoder).not.toBeNull();
    });

    it('includeRoute', function() {
        var gc = new AddressGadgetGMap();
        expect(gc.includeRoute('AU')).toBe(false);
        expect(gc.includeRoute('CA')).toBe(true);
        expect(gc.includeRoute('GB')).toBe(true);
        expect(gc.includeRoute('NZ')).toBe(false);
        expect(gc.includeRoute('US')).toBe(false);
    });

    testAllLookupPostalCode(new AddressGadgetGMap());
});

function testAllLookupPostalCode(gc) {
    testLookupPostalCode(
        gc,
        {
            postalCode: 'W1B 3BR',
            countryCode: 'GB'
        },
        {
            lat: 51.5142181,
            lon: -0.14096349999999802,
            locality: 'London',
            tlaal: null,
            tlaas: null,
            postalCode: 'W1B 3BR',
            countryCode: 'GB',
            streetNumber: null,
            route: null,
            neighborhood: null
        }
    );
    testLookupPostalCode(
        gc,
        {
            postalCode: 'W1D 5JL',
            countryCode: 'GB'
        },
        {
            lat: 51.5132039,
            lon: -0.13090199999999186,
            locality: 'London',
            tlaal: null,
            tlaas: null,
            postalCode: 'W1D 5JL',
            countryCode: 'GB',
            streetNumber: '23-25',
            route: 'Old Compton Street',
            neighborhood: null
        }
    );
    testLookupPostalCode(
        gc,
        {
            postalCode: '1023',
            countryCode: 'NZ'
        },
        {
            lat: -36.8903446,
            lon: 174.7707223,
            locality: 'Auckland',
            tlaal: null,
            tlaas: null,
            postalCode: '1023',
            countryCode: 'NZ'
        }
    );
    testLookupPostalCode(
        gc,
        {
            postalCode: 'V6R 2B2',
            countryCode: 'CA'
        },
        {
            lat: 49.2642568,
            lon: -123.17937890000002,
            locality: 'Vancouver',
            tlaal: 'British Columbia',
            tlaas: 'BC',
            postalCode: 'V6R 2B2',
            countryCode: 'CA',
            streetNumber: '3338-3396',
            route: 'West Broadway',
            neighborhood: 'Kitsilano'
        }
    );
    testLookupPostalCode(
        gc,
        {
            postalCode: 'M4W 2H2',
            countryCode: 'CA'
        },
        {
            lat: 43.6740068,
            lon: -79.3880418,
            locality: 'Toronto',
            tlaal: 'Ontario',
            tlaas: 'ON',
            postalCode: 'M4W 2H2',
            countryCode: 'CA',
            streetNumber: '869',
            route: 'Yonge Street',
            neighborhood: 'Rosedale'
        }
    );
    testLookupPostalCode(
        gc,
        {
            postalCode: '90210',
            countryCode: 'US'
        },
        {
            lat: 34.102898,
            lon: -118.40889300000003,
            locality: 'Beverly Hills',
            tlaal: 'California',
            tlaas: 'CA',
            postalCode: '90210',
            countryCode: 'US'
        }
    );
    testLookupPostalCode(
        gc,
        {
            postalCode: '92120',
            countryCode: 'US'
        },
        {
            lat: 32.7931503,
            lon: -117.07345599999996,
            locality: 'San Diego',
            tlaal: 'California',
            tlaas: 'CA',
            postalCode: '92120',
            countryCode: 'US'
        }
    );
    testLookupPostalCode(
        gc,
        {
            postalCode: '4113',
            countryCode: 'AU'
        },
        {
            lat: -27.589278,
            lon: 153.079161,
            locality: 'Runcorn',
            tlaal: 'Queensland',
            tlaas: 'QLD',
            postalCode: '4113',
            countryCode: 'AU'
        }
    );
    testLookupPostalCode(
        gc,
        {
            postalCode: '3188',
            countryCode: 'AU'
        },
        {
            lat: -37.939468,
            lon: 145.013643,
            locality: 'Hampton',
            tlaal: 'Victoria',
            tlaas: 'VIC',
            postalCode: '3188',
            countryCode: 'AU'
        }
    );
}

function testLookupPostalCode(gc, addr, expectedAddr) {
    describe('lookupPostalCode', function() {
        var _res, _addr, flag;

        it('performs a lookup by postal code for: ' + addr.postalCode, function() {
            // perform lookup
            runs(function() {
                gc.lookupPostalCode(
                    addr,
                    {
                        onFullAddressMatch: function(res, addr) {
                            _res = res;
                            _addr = addr;
                            done = true;
                        },
                        onNoMatch: function(res, addr) {
                            _res = res;
                            _addr = addr;
                            done = true;
                        }
                    });
            });

            // wait for async call to complete
            waitsFor(function() {
                return _res;
            }, 'res and addr should be set', 1500);

            // test result
            runs(function() {
                expect(_res).not.toBeNull();
                expect(_res.code).toEqual('SUCCESS');
                expect(_res.exec_time).toBeGreaterThan(0);
                for (var attr in expectedAddr) {
                    expect(_addr[attr]).toBeDefined('Attribute [' + attr + '] doesn\'t exist in returned struct.');
                    expect(_addr[attr]).toEqual(expectedAddr[attr]);
                }
            });

            // delay before next test or the mapping API rejects the requests
            runs(function() {
                flag = false;
                setTimeout(function() {
                    flag = true;
                }, 2000);
            });
            waitsFor(function() {
                return flag;
            }, "short delay before the next test", 2000);
        });
    });
}
