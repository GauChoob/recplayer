import binReader from "./binReader";

export default function levReader(data) {
  var br = binReader(data);

  var ticker = (function() {
    var n = 0;
    return function(m) {
      n += m;
      return n - m;
    };
  })();

  var offsType = ticker(5);
  function levVersion() {
    br.seek(offsType);
    return br.seq(5);
  }
  var elma = levVersion() == "POT14";
  if (elma) ticker(2);
  var offsIdent = ticker(4);
  var offsIntegrities = ticker(4 * 8);
  var descLength = elma ? 51 : 15;
  var offsDesc = ticker(descLength);
  if (elma) {
    var offsLgr = ticker(16);
    var offsGround = ticker(10);
    var offsSky = ticker(10);
  }
  else ticker(44); // Across lev

  var offsPolyCount = ticker(8);
  var offsPolys = ticker(0);

  function polyCount() {
    br.seek(offsPolyCount);
    return Math.floor(br.binFloat64le());
  }

  function objCount() {
    br.seek(offsObjCount);
    return Math.floor(br.binFloat64le());
  }

  function picCount() {
    if (elma) {
      br.seek(offsPicCount);
      return Math.floor(br.binFloat64le());
    } else return 0;
  }

  var offsObjCount = (function() {
    var pc = polyCount();
    br.seek(offsPolys);
    for (var x = 0; x < pc; x++) {
      if (elma) br.skip(4); // grass
      br.skip(br.word32le() * (8 + 8));
    }
    return br.pos();
  })();
  var offsObjs = offsObjCount + 8;
  var offsPicCount = elma ? (function() {
    br.seek(offsObjCount);
    return offsObjs + Math.floor(br.binFloat64le()) * (8 + 8 + (4 + 4 + 4));
  })() : 0;
  var offsPics = offsPicCount + 8;

  var obj, pic; // initialised in the object literal :\

  return (window.lrd = {
    rightType: function() {
      return ["POT14", "POT06"].indexOf(levVersion()) >= 0;
    },

    ident: function() {
      br.seek(offsIdent);
      return br.seq(4);
    },

    integrities: function() {
      br.seek(offsIntegrities);
      var o = [];
      for (var x = 0; x < 4; x++) o.push(br.binFloat64le());
      return o;
    },

    desc: function() {
      br.seek(offsDesc);
      return br.string(descLength);
    },

    lgr: function() {
      if (elma) {
        br.seek(offsLgr);
        return br.string(16).toLowerCase();
      } else return "default";
    },

    ground: function() {
      if (elma) {
        br.seek(offsGround);
        return br.string(10).toLowerCase();
      } else return "ground";
    },

    sky: function() {
      if (elma) {
        br.seek(offsSky);
        return br.string(10).toLowerCase();
      } else return "sky";
    },

    polyCount: polyCount,
    objCount: objCount,
    picCount: picCount,

    polyReader: function(forEachPoly) {
      /* lr.polyReader(function(grass, vcount, vertices){
				 *   // for each polygon
				 *   vertices(function(x, y){
				 *     // for each vertex in it
				 *   });
				 * });
				 */

      var count = polyCount();
      br.seek(offsPolys);
      for (var x = 0; x < count; x++) {
        var grass = elma ? br.word32le() : 0,
          vcount = br.word32le(),
          pos = br.pos();
        void (function(grass, vcount, pos) {
          br.seek(pos);
          forEachPoly(grass != 0, vcount, function(forEachVertex) {
            for (var y = 0; y < vcount; y++) {
              br.seek(pos + y * (8 + 8));
              forEachVertex(br.binFloat64le(), br.binFloat64le());
            }
          });
        })(grass, vcount, pos);
        br.seek(pos + vcount * (8 + 8));
      }
    },

    obj: (obj = function(n, onFlower, onApple, onKiller, onStart) {
      // onError? maybe
      br.seek(offsObjs + n * (8 + 8 + (elma ? (4 + 4 + 4) : 4)));
      var vx = br.binFloat64le(),
        vy = br.binFloat64le();
      var obj = br.word32le(),
        grav = elma ? br.word32le() : 0,
        anim = elma ? br.word32le() : 0;
      switch (obj) {
        case 1:
          return onFlower(vx, vy);
        case 2:
          return onApple(vx, vy, grav, anim);
        case 3:
          return onKiller(vx, vy);
        case 4:
          return onStart(vx, vy);
        default:
          throw new Error("hmm: " + obj + ", x = " + vx + ", y = " + vy);
      }
    }),

    obj_: function(n) {
      function h(s) {
        return function(vx, vy, grav, anim) {
          var o = { type: s, x: vx, y: vy };
          if (grav !== undefined) {
            o.grav = grav;
            o.anim = anim;
          }
          return o;
        };
      }

      return obj(n, h("flower"), h("apple"), h("killer"), h("start"));
    },

    pic: (pic = function(n, onPic) {
      br.seek(offsPics + n * (10 + 10 + 10 + 8 + 8 + 4 + 4));
      var picture = br.pstring(10).toLowerCase(),
        texture = br.pstring(10).toLowerCase(),
        mask = br.pstring(10).toLowerCase();
      var vx = br.binFloat64le(),
        vy = br.binFloat64le();
      var dist = br.word32le(),
        clipping = br.word32le();
      clipping = ["u", "g", "s"][clipping];
      return onPic(picture, texture, mask, vx, vy, dist, clipping);
    }),

    pic_: function(n) {
      return pic(n, function(picture, texture, mask, vx, vy, dist, clipping) {
        return {
          picture: picture,
          texture: texture,
          mask: mask,
          x: vx,
          y: vy,
          dist: dist,
          clipping: clipping
        };
      });
    }
  });
}
