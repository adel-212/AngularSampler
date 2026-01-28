export const $ = (s, root=document) => root.querySelector(s);
export const $$ = (s, root=document) => [...root.querySelectorAll(s)];
export function el(tag, attrs={}, children=[]){
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v]) => (k in n ? n[k]=v : n.setAttribute(k,v)));
  children.forEach(c => n.append(c));
  return n;
}
