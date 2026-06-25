import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Monkeypatch para evitar crasheos por Google Translate y otras extensiones que modifican el DOM.
// Cuando un traductor envuelve un nodo de texto en <font>, el Virtual DOM de React pierde la referencia
// del padre real, causando un error fatal "Failed to execute removeChild on Node".
if (typeof Node !== 'undefined' && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild
  Node.prototype.removeChild = function(child) {
    if (child && child.parentNode !== this) {
      return child
    }
    return originalRemoveChild.apply(this, arguments)
  }

  const originalInsertBefore = Node.prototype.insertBefore
  Node.prototype.insertBefore = function(newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) {
      return this.appendChild(newNode)
    }
    return originalInsertBefore.apply(this, arguments)
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
