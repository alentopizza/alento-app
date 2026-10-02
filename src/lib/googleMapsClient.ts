"use client";

export type GoogleMapsImportRuntime = {
  maps: {
    importLibrary: (library: string) => Promise<unknown>;
  };
};

function getGoogleWindow() {
  return window as typeof window & {
    google?: GoogleMapsImportRuntime;
  };
}

function installGoogleMapsBootstrap(key: string) {
  if (getGoogleWindow().google?.maps?.importLibrary) return;

  const bootstrapId = "alento-google-maps-bootstrap";
  if (document.getElementById(bootstrapId)) return;

  const script = document.createElement("script");
  script.id = bootstrapId;
  script.textContent = `
    (g=>{
      var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",
        q="__ib__",m=document,b=window;
      b=b[c]||(b[c]={});
      var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,
        u=()=>h||(h=new Promise(async(f,n)=>{
          await (a=m.createElement("script"));
          e.set("libraries",[...r]+"");
          for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t[0].toLowerCase()),g[k]);
          e.set("callback",c+".maps."+q);
          a.src="https://maps."+c+"apis.com/maps/api/js?"+e;
          d[q]=f;
          a.onerror=()=>h=n(Error(p+" could not load."));
          a.nonce=m.querySelector("script[nonce]")?.nonce||"";
          m.head.append(a)
        }));
      d[l]
        ? console.warn(p+" only loads once. Ignoring:",g)
        : d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))
    })({
      key: "__ALENTO_MAPS_KEY__",
      v: "weekly",
      language: "es",
      region: "CO"
    });
  `;

  script.textContent = script.textContent.replace(
    '"__ALENTO_MAPS_KEY__"',
    JSON.stringify(key),
  );
  document.head.appendChild(script);
}

export async function loadGoogleMapsClient<T extends GoogleMapsImportRuntime>() {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  if (!key) {
    throw new Error("Google Maps no está configurado.");
  }

  installGoogleMapsBootstrap(key);

  const runtime = getGoogleWindow().google;
  if (!runtime?.maps?.importLibrary) {
    throw new Error("No fue posible iniciar Google Maps.");
  }

  return runtime as T;
}
