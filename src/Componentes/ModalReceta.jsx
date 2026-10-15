import React, { useRef } from 'react';
import { FaPrint, FaTimes, FaStethoscope } from 'react-icons/fa';
import '../Estilos/ModalReceta.css';

const ModalReceta = ({ isOpen, onClose, datosReceta }) => {
  const printRef = useRef();

  if (!isOpen || !datosReceta) return null;

  const {
    // Datos del Médico
    nombreMedico = 'Médico Tratante',
    universidad = '',
    cedulaPartero = '',
    especialidades = [],
    direccionMedico = '',
    localidadMedico = '',
    telefonoMedico = '',
    correoMedico = '',
    firmaMedico = '', // URL o Base64 de la imagen de la firma del médico
    // Datos del Paciente
    nombrePx = 'Paciente',
    edadPx = '',
    sexoPx = '',
    alergiasPx = 'Negadas',
    // Signos Vitales
    ta = '',
    fc = '',
    temp = '',
    spo2 = '',
    peso = '',
    talla = '',
    imc = '',
    // Datos de la Nota
    folio = '',
    fecha = '',
    diagnostico = '',
    tratamiento = ''
  } = datosReceta;

  const handleImprimir = () => {
    const contenido = printRef.current.innerHTML;
    const ventanaImpresion = window.open('', '_blank', 'width=900,height=750');

    ventanaImpresion.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receta Médica - ${nombrePx}</title>
          <style>
            @page {
              size: letter portrait;
              margin: 0mm;
            }
            html, body {
              width: 215.9mm;
              height: 279.4mm;
              margin: 0;
              padding: 0;
              font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              color: #1e293b;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .receta-half-page {
              width: 215.9mm;
              height: 139.7mm;
              max-height: 139.7mm;
              padding: 8mm 10mm 6mm 10mm;
              box-sizing: border-box;
              border-bottom: 1px dashed #94a3b8;
              display: flex;
              flex-direction: column;
            }
            .receta-sheet {
              border: 1.5px solid #1e3a8a;
              border-radius: 8px;
              padding: 10px 15px;
              width: 100%;
              height: 100%;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
            .receta-top-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2px double #1e3a8a;
              padding-bottom: 6px;
              margin-bottom: 6px;
            }
            .doc-main-info {
              text-align: left;
              max-width: 68%;
            }
            .doc-main-info h1 {
              margin: 0 0 2px 0;
              color: #1e3a8a;
              font-size: 14.5px;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            }
            .doc-subtitle {
              margin: 0 0 2px 0;
              font-weight: 700;
              font-size: 10.5px;
              color: #334155;
            }
            .doc-cedulas {
              font-size: 10px;
              color: #475569;
              margin: 1px 0;
              line-height: 1.25;
            }
            .doc-contact-right {
              text-align: right;
              font-size: 10px;
              color: #475569;
              line-height: 1.25;
            }
            .folio-box {
              display: inline-block;
              background: #eff6ff;
              border: 1px solid #bfdbfe;
              color: #1e40af;
              padding: 1px 7px;
              border-radius: 4px;
              font-weight: 700;
              margin-bottom: 2px;
              font-size: 10px;
            }
            .px-info-box {
              background-color: #f8fafc;
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              padding: 5px 10px;
              margin-bottom: 6px;
              font-size: 10.5px;
              text-align: left;
            }
            .px-row-top {
              display: flex;
              justify-content: space-between;
              flex-wrap: wrap;
              gap: 8px;
              margin-bottom: 3px;
              padding-bottom: 3px;
              border-bottom: 1px dashed #cbd5e1;
            }
            .px-row-bottom {
              display: flex;
              flex-wrap: wrap;
              gap: 10px;
              font-size: 10px;
              color: #334155;
            }
            .alergia-tag {
              color: #b91c1c;
              font-weight: 700;
            }
            .rx-body {
              flex: 1;
              padding: 2px 2px;
              text-align: left;
              overflow: hidden;
            }
            .diag-line {
              font-size: 10.5px;
              background: #f1f5f9;
              padding: 3px 8px;
              border-left: 3px solid #3b82f6;
              border-radius: 3px;
              margin-bottom: 5px;
              text-align: left;
            }
            .rx-symbol {
              font-size: 12px;
              font-weight: 800;
              color: #1e3a8a;
              font-family: Georgia, serif;
              margin-bottom: 4px;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 2px;
              text-align: left;
            }
            .rx-text {
              white-space: pre-wrap;
              text-align: left !important;
              font-size: 11.5px;
              line-height: 1.4;
              color: #0f172a;
              margin: 0;
            }
            .receta-footer {
              margin-top: 6px;
              padding-top: 6px;
              border-top: 1px solid #cbd5e1;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .footer-note {
              font-size: 9px;
              color: #64748b;
              max-width: 58%;
              text-align: left;
              line-height: 1.2;
            }
            .firma-block {
              text-align: center;
              width: 190px;
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            .firma-img {
              max-height: 44px;
              max-width: 165px;
              object-fit: contain;
              margin-bottom: -4px;
              mix-blend-mode: multiply;
            }
            .firma-line {
              width: 100%;
              border-top: 1px solid #1e293b;
              margin-bottom: 2px;
            }
            .firma-name {
              font-size: 10.5px;
              font-weight: 700;
              color: #1e293b;
            }
            .firma-label {
              font-size: 9px;
              color: #64748b;
            }
          </style>
        </head>
        <body>
          <div class="receta-half-page">
            ${contenido}
          </div>
          <script>
            window.onload = function() {
              window.focus();
              window.print();
              window.onafterprint = function() { window.close(); };
            };
          </script>
        </body>
      </html>
    `);
    ventanaImpresion.document.close();
  };

  return (
    <div className="modal-receta-overlay" onClick={onClose}>
      <div className="modal-receta-container" onClick={(e) => e.stopPropagation()}>
        
        {/* BARRA DE ACCIONES SUPERIOR */}
        <div className="modal-receta-toolbar">
          <div className="toolbar-title">
            <FaStethoscope /> <span>Vista Previa de Receta (Hoja Vertical - Media Página Superior)</span>
          </div>
          <div className="toolbar-actions">
            <button type="button" onClick={handleImprimir} className="btn-print-now">
              <FaPrint /> Imprimir / Guardar PDF
            </button>
            <button type="button" onClick={onClose} className="btn-close-preview">
              <FaTimes /> Cerrar
            </button>
          </div>
        </div>

        {/* HOJA DE RECETA MEDIA PÁGINA SUPERIOR */}
        <div className="modal-receta-scroll">
          <div ref={printRef} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            <div className="receta-sheet">
              
              <div>
                {/* ENCABEZADO MÉDICO */}
                <div className="receta-top-header">
                  <div className="doc-main-info">
                    <h1>Dr(a). {nombreMedico}</h1>
                    <p className="doc-subtitle">
                      Médico Cirujano y Partero
                      {universidad ? ` • ${universidad}` : ''}
                      {cedulaPartero ? ` • Céd. Prof. ${cedulaPartero}` : ''}
                    </p>
                    {especialidades.map((esp, idx) => (
                      <div key={idx} className="doc-cedulas">
                        <strong>{esp.nombre}</strong>
                        {esp.universidad ? ` (${esp.universidad})` : ''}
                        {esp.cedula ? ` • Céd. Esp. ${esp.cedula}` : ''}
                      </div>
                    ))}
                  </div>

                  <div className="doc-contact-right">
                    {folio && <div className="folio-box">Folio: #{folio.slice(-6).toUpperCase()}</div>}
                    <div><strong>Fecha:</strong> {fecha}</div>
                    {telefonoMedico && <div>Tel: {telefonoMedico}</div>}
                    {direccionMedico && <div>{direccionMedico}</div>}
                    {localidadMedico && <div>{localidadMedico}</div>}
                    {correoMedico && <div>{correoMedico}</div>}
                  </div>
                </div>

                {/* FICHA DEL PACIENTE Y SIGNOS VITALES */}
                <div className="px-info-box">
                  <div className="px-row-top">
                    <div><strong>Paciente:</strong> {nombrePx}</div>
                    {edadPx !== '' && edadPx !== null && <div><strong>Edad:</strong> {edadPx} años</div>}
                    {sexoPx && sexoPx !== 'N/A' && sexoPx !== 'N/E' && <div><strong>Sexo:</strong> {sexoPx}</div>}
                    <div>
                      <strong>Alergias:</strong>{' '}
                      <span className={alergiasPx && alergiasPx.toLowerCase() !== 'negadas' ? 'alergia-tag' : ''}>
                        {alergiasPx || 'Negadas'}
                      </span>
                    </div>
                  </div>

                  {(peso || talla || imc || ta || fc || temp || spo2) && (
                    <div className="px-row-bottom">
                      {peso && <span><strong>Peso:</strong> {peso} kg</span>}
                      {talla && <span><strong>Talla:</strong> {talla} m</span>}
                      {imc && <span><strong>IMC:</strong> {imc}</span>}
                      {ta && <span><strong>T.A.:</strong> {ta} mmHg</span>}
                      {fc && <span><strong>F.C.:</strong> {fc} lpm</span>}
                      {temp && <span><strong>Temp:</strong> {temp} °C</span>}
                      {spo2 && <span><strong>SpO2:</strong> {spo2}%</span>}
                    </div>
                  )}
                </div>

                {/* CUERPO DE LA RECETA ALINEADO A LA IZQUIERDA */}
                <div className="rx-body">
                  {diagnostico && (
                    <div className="diag-line">
                      <strong>Diagnóstico:</strong> {diagnostico}
                    </div>
                  )}

                  <div className="rx-symbol">Rx — Plan de Manejo y Tratamiento</div>
                  <div className="rx-text">
                    {(tratamiento || 'Sin indicaciones registradas.').trim()}
                  </div>
                </div>
              </div>

              {/* PIE DE PÁGINA Y FIRMA CON IMAGEN SOBRE LA LÍNEA */}
              <div className="receta-footer">
                <div className="footer-note">
                  Favor de seguir las indicaciones médicas. No suspenda ni modifique las dosis sin consultar a su médico. En caso de reacción adversa acuda a valoración inmediata.
                </div>

                <div className="firma-block">
                  {firmaMedico && (
                    <img 
                      src={firmaMedico} 
                      alt="Firma del Médico" 
                      className="firma-img" 
                    />
                  )}
                  <div className="firma-line"></div>
                  <div className="firma-name">Dr(a). {nombreMedico}</div>
                  <div className="firma-label">Firma del Médico</div>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ModalReceta;