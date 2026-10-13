function f(r){return r<1024?`${r} B`:r<1024*1024?`${(r/1024).toFixed(1)} KB`:`${(r/(1024*1024)).toFixed(2)} MB`}export{f};
