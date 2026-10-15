import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBirthdayCake, FaVenusMars, FaMapMarkerAlt, FaPhoneAlt, FaChevronRight } from 'react-icons/fa';

const Listapxcard = (props) => {
  const navigate = useNavigate();

  // Soporta recibir datos como item={...}, paciente={...} o props directos {...item}
  const data = props.item || props.paciente || props;

  const uid = data.uid || data.id || '';
  const nombre = data.nombre || data.nombrecom || 'Sin Nombre';
  const fechaNac = data.fecha_nac || data.fechanacimiento || 'Sin registro';
  const sexo = data.sexo || 'N/D';
  const localidad = data.localidad || '';
  const celular = data.num_cel || data.celular || '';
  const foto = data.fotoperfil && data.fotoperfil !== 'null'
    ? data.fotoperfil
    : 'https://cdn-icons-png.flaticon.com/512/387/387561.png';

  const irAlExpediente = () => {
    if (uid) {
      navigate(`/px/${uid}`);
    }
  };

  return (
    <div 
      onClick={irAlExpediente}
      style={cardStyle}
      title="Haz clic para abrir el expediente del paciente"
    >
      <img 
        src={foto} 
        alt={nombre} 
        style={avatarStyle} 
      />

      <div style={infoContainerStyle}>
        <h3 style={nameStyle}>{nombre}</h3>

        <div style={detailRowStyle}>
          <FaBirthdayCake style={{ color: '#95a5a6', fontSize: '0.85rem' }} />
          <span>{fechaNac}</span>
        </div>

        <div style={detailRowStyle}>
          <FaVenusMars style={{ color: '#95a5a6', fontSize: '0.85rem' }} />
          <span>{sexo}</span>
          {localidad && (
            <>
              <span style={{ margin: '0 4px', color: '#ccc' }}>•</span>
              <FaMapMarkerAlt style={{ color: '#3498db', fontSize: '0.8rem' }} />
              <span style={{ color: '#2980b9', fontWeight: 600 }}>{localidad}</span>
            </>
          )}
        </div>

        {celular && (
          <div style={detailRowStyle}>
            <FaPhoneAlt style={{ color: '#95a5a6', fontSize: '0.8rem' }} />
            <span>{celular}</span>
          </div>
        )}
      </div>

      <div style={arrowBoxStyle}>
        <FaChevronRight />
      </div>
    </div>
  );
};

const cardStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #e1e8ed',
  borderRadius: '14px',
  padding: '16px 18px',
  display: 'flex',
  alignItems: 'center',
  gap: '15px',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  userSelect: 'none'
};

const avatarStyle = {
  width: '62px',
  height: '62px',
  borderRadius: '50%',
  objectFit: 'cover',
  border: '2px solid #e8f4fd',
  flexShrink: 0
};

const infoContainerStyle = {
  flex: 1,
  minWidth: 0
};

const nameStyle = {
  margin: '0 0 6px 0',
  fontSize: '1.1rem',
  color: '#2c3e50',
  fontWeight: 700,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
};

const detailRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '0.85rem',
  color: '#64748b',
  marginTop: '3px'
};

const arrowBoxStyle = {
  color: '#3498db',
  fontSize: '1rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

export default Listapxcard;