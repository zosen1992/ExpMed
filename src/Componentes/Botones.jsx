import React from 'react'
//import "../Estilos/Infop2.css"

function Botones(props) {
  return (
    <div className='opcionesbtns'>
        <button>
        <p className='iconomp'>{props.iconomp}</p>
        <p className='optxt'>{props.opcionbtn}</p>
        </button>
    </div>
  )
}
export default Botones