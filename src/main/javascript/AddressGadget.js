// indexOf does not exist in IE8 and earlier
Array.prototype.hasObject = (
  !Array.indexOf ? function (o)
  {
    var l = this.length + 1;
    while (l -= 1)
    {
        if (this[l - 1] === o)
        {
            return true;
        }
    }
    return false;
  } : function (o)
  {
    return (this.indexOf(o) !== -1);
  }
);

function AddressGadget() {}
// postalCode, countryCode must be set in addr
AddressGadget.prototype.lookupPostalCode = function(addr, callbacks) {}
AddressGadget.prototype.lookupFullAddress = function(addr, callbacks) {}
// Performs a callback to the given callback function name in a structure of callbacks for the given arguments.
// callbacks: structure of callbacks
// fnName: name to look up in the callbacks
// args: a dynamic list of arguments to pass to the function
AddressGadget.prototype.doCallback = function(callbacks, fnName, args) {
    if (callbacks.hasOwnProperty(fnName)) {
        callbacks[fnName].apply(this, Array.prototype.slice.call(arguments, 2));
    }
}

function AddressGadgetGMap() {
    AddressGadget.call(this);
    this.geocoder = new google.maps.Geocoder();
    this.routeInPCode = ['CA','GB']; // countries with postal codes that identify a very small set of addresses, generally down to a block on a street
}
AddressGadgetGMap.prototype = AddressGadget.prototype;

// Some countries have postal codes that are specific to a street while others cover large areas
AddressGadgetGMap.prototype.includeRoute = function(countryCode) {
    return this.routeInPCode.indexOf(countryCode.toUpperCase()) >= 0;
}

// ac: a value in the address_components[] array
AddressGadgetGMap.prototype.isAddrComponentOfType = function(ac, type) {
    for (var j = 0; j < ac.types.length; j++) {
        if (ac.types[j] === type) {
            return true;
        }
    }
    return false;
}
AddressGadgetGMap.prototype.findResult = function(results, desiredType, testfn) {
    var arr = [];
    var bestguess = null;
    for (var i = 0; i < results.length; i++) {
        var addr_components = results[i].address_components;
        for (var j = 0; j < addr_components.length; j++) {
            var ac = addr_components[j];
            if (this.isAddrComponentOfType(ac, desiredType)) {
                // this address component matches the inputs
                if (bestguess == null) {
                    bestguess = results[i];
                }
                if (testfn(ac)) {
                    return results[i];
                }
            }
        }
    }
    return bestguess;
}
// param 1: addr_components
// param 2: property to return
// param 3..n: desiredType
AddressGadgetGMap.prototype.getAddressComponent = function(addr_components, prop, desiredType) {
    var addr_components = arguments[0];
    var prop = arguments[1];
    for (var i = 0; i < addr_components.length; i++) {
        var ac = addr_components[i];
        for (var j = 2; j < arguments.length; j++) {
            if (this.isAddrComponentOfType(ac, arguments[j])) {
                return ac[prop];
            }
        }
    }
    return null;
}
AddressGadgetGMap.prototype.equalsIgnoreCaseWithRegex = function (s1, s2, replace, value, firstN) {
    if (!s1 || !s2) return false;
    s1 = s1.toUpperCase().replace(replace, value);
    s2 = s2.toUpperCase().replace(replace, value);
    if (firstN) {
        s1 = s1.slice(0, firstN);
        s2 = s2.slice(0, firstN);
    }
    return s1 == s2;
}
// google gets a lot of Canadian postal codes wrong, so only match on the first 3 characters
AddressGadgetGMap.prototype.firstN = function(countryCode) {
    if (countryCode.toUpperCase() === 'CA') { return 3; }
    return 0;
}
AddressGadgetGMap.prototype.toAddr = function(addr, res, includeRoute) {
    var acArr = res.address_components;
    var latlon = res.geometry.location;
    var p = this.getAddressComponent(acArr, 'long_name', 'postal_code');
    if (!this.equalsIgnoreCaseWithRegex(addr.postalCode, p, /[\s-]+/g, '', 0)) {
        // if the returned postal code doesn't match the input, don't overwrite the user's input
        p = addr.postalCode.toUpperCase();
    }
    var fLong = function(ac) { return ac.long_name; }
    var fShort = function(ac) { return ac.short_name; }
    var o = {
        lat: latlon.lat(),
        lon: latlon.lng(),
        locality: this.getAddressComponent(acArr, 'long_name', 'postal_town', 'locality'),
        tlaal: this.getAddressComponent(acArr, 'long_name', 'administrative_area_level_1'),
        tlaas: this.getAddressComponent(acArr, 'short_name', 'administrative_area_level_1'),
        postalCode: p,
        countryCode: this.getAddressComponent(acArr, 'short_name', 'country'),
        country: this.getAddressComponent(acArr, 'long_name', 'country'),
        accuracy: res.geometry.location_type,
        debug: res
    };
    if (includeRoute) {
        o.streetNumber = this.getAddressComponent(acArr, 'long_name', 'street_number');
        o.route = this.getAddressComponent(acArr, 'long_name', 'route');
        o.neighborhood = this.getAddressComponent(acArr, 'long_name', 'neighborhood');
    }
    return o;
}
AddressGadgetGMap.prototype.lookupPostalCode = function(addr, callbacks) {
    var t = this;
    var v = addr.postalCode + ", " + addr.countryCode;
    var ms = Date.now();
    // first transform the postal code to lat/lon
    t.geocoder.geocode(
        {
            'address': addr.postalCode,
            'region': addr.countryCode
        },
        function(results, status) {
            var res = {
                op: 'lookupPostalCode',
                server: 'google',
                exec_time: Date.now() - ms,
                serverResponseCode: status
            };
            var svrRes = results;
            if (status == google.maps.GeocoderStatus.ZERO_RESULTS) {
                res.code = 'NO_MATCH';
                t.doCallback(callbacks, 'onNoMatch', res);
            } else if (status == google.maps.GeocoderStatus.OK) {
                var latlon = results[0].geometry.location; // TODO: why 0?
                // second perform a reverse geocode lookup to identify the most granular address possible
                t.geocoder.geocode(
                    {'latLng': latlon},
                    function(results, status) {
                        res.exec_time = Date.now() - ms;
                        res.serverResponseCode = status;
                        svrRes = results;
                        if (status == google.maps.GeocoderStatus.OK) {
                            // find the address component matching the postal code
                            // use this address component to populate the suggestions (might be incomplete for bad input)
                            var dbg = t.findResult(results, 'postal_code', function(ac) {
                                // sometimes weird postal codes come back - this ensures only the desired one is used
                                var s = ac.long_name;
                                return t.equalsIgnoreCaseWithRegex(s, addr.postalCode, /[\s-]+/g, '', t.firstN(addr.countryCode));
                            });
                            var a = t.toAddr(addr, dbg, t.includeRoute(addr.countryCode));
                            if (a.countryCode.toUpperCase() !== addr.countryCode.toUpperCase()) {
                                // no match when country mismatch
                                res.code = 'NO_MATCH';
                                t.doCallback(callbacks, 'onNoMatch', res);
                            } else {
                                res.code = 'SUCCESS';
                                t.doCallback(callbacks, 'onFullAddressMatch', res, a);
                            }
                        } else {
                            res.code = 'ERROR';
                            res.msg = 'Reverse geocode lookup from postal code [' + v + '] and lat/lon [' + latlon + '] failed with status: ' + status;
                            t.doCallback(callbacks, 'onError', res);
                        }
                    }
                );
            } else {
                res.code = 'ERROR';
                res.msg = "Postal code lookup [" + v + "] failed with status: " + status;
                t.doCallback(callbacks, 'onError', res);
            }
            t.doCallback(callbacks, 'logResult', res, svrRes);
        }
    );
}
AddressGadgetGMap.prototype.lookupFullAddress = function(addr, callbacks) {
    var t = this;
    var ms = Date.now();
    t.geocoder.geocode(
        {'address': addr.toString()},
        function(results, status) {
            var res = {
                op: 'lookupFullAddress',
                server: 'google',
                exec_time: Date.now() - ms,
                serverResponseCode: status
            };
            var addrOut = addr;
            if (status == google.maps.GeocoderStatus.OK) {
                if (results.length) {
                    res.code = 'SUCCESS';
                    addrOut = t.toAddr(addr, results[0], true);
                } else {
                    res.code = 'NO_MATCH';
                }
            } else if (status == google.maps.GeocoderStatus.ZERO_RESULTS) {
                res.code = 'NO_MATCH';
            } else {
                res.code = 'ERROR';
            }
            t.doCallback(callbacks, 'onFinish', res, addrOut);
        }
    );
}
