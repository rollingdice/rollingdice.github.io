const l=(n,o)=>{let e;const t=function(...c){const u=()=>{e=null,n.apply(this,c)};e&&clearTimeout(e),e=setTimeout(u,o)};return t.cancel=()=>{e&&clearTimeout(e),e=null},t};export{l as d};
