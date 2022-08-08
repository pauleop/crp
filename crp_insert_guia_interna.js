/**
 *  Copyright (c) 1988-PRESENT deister software, All Rights Reserved.
 * 
 *  All information contained herein is, and remains the property of deister software.
 *  The intellectual and technical concepts contained herein are proprietary to 
 *  deister software and may be covered by trade secret or copyright law. 
 *  Dissemination of this information or reproduction of this material is strictly 
 *  forbidden unless prior written permission is obtained from deister software.
 *  Access to the source code contained herein is hereby forbidden to anyone except
 *  current deister software employees, managers or contractors who have executed 
 * "Confidentiality and Non-disclosure" agreements explicitly covering such access.
 *  The copyright notice above does not evidence any actual or intended publication 
 *  for disclosure of this source code, which includes information that is confidential 
 *  and/or proprietary, and is a trade secret, of deister software
 * 
 *  ANY REPRODUCTION, MODIFICATION, DISTRIBUTION, PUBLIC  PERFORMANCE,
 *  OR PUBLIC DISPLAY OF OR THROUGH USE  OF THIS  SOURCE CODE  WITHOUT THE 
 *  EXPRESS WRITTEN CONSENT OF COMPANY IS STRICTLY PROHIBITED, AND IN VIOLATION
 *  OF APPLICABLE LAWS AND INTERNATIONAL TREATIES.THE RECEIPT OR POSSESSION OF 
 *  THIS SOURCE CODE AND/OR RELATED INFORMATION DOES NOT CONVEY OR IMPLY ANY 
 *  RIGHTS TO REPRODUCE, DISCLOSE OR DISTRIBUTE ITS CONTENTS, OR TO MANUFACTURE, 
 *  USE, OR SELL ANYTHING THAT IT MAY DESCRIBE, IN WHOLE OR IN PART.
 * 
 *  -----------------------------------------------------------------------------
 *  JS: crp_insert_guia_interna
 *      Version:    V1.0
 *      Date:       2022.02.26                                          
 *      Description: Insert the internal guide JSON CRPi in the intermediate table AXIONAL     
 * 
 */
 function crp_insert_guia_interna(pObjData) { 

    /**
     * LOCAL FUNCTION: __getAlmacen
     * 
     * Función local que obtiene almacén origen o destino.
     * 
     *      @param   {string}   pStrCodalmCRP   Código del almacén           
     * 
     */ 
    function __getAlmacen(pStrCodalmCRP){ 

        // =============================================================    
        // Se obtiene código de almacén y cuenta Axional desde Flexline
        // ============================================================= 
        var mObjCodalmAxional = Ax.db.executeQuery(`
                <select >
                    <columns>            
                        codalm_axional, 
                        cuenta
                    </columns>
                    <from table='crp_flex_gen_almacen'/> 
                    <where>
                        crp_flex_gen_almacen.codigo = ? 
                    </where>
                </select>
            `, pStrCodalmCRP).toOne();
    
        if (!mObjCodalmAxional.codalm_axional){
            mObjCodalmAxional = Ax.db.executeQuery(`
                <select >
                    <columns>            
                        codalm_axional, 
                        cuenta
                    </columns>
                    <from table='crp_flex_farptoconsumo'/> 
                    <where>
                        crp_flex_farptoconsumo.codigo = ? 
                    </where>
                </select>
            `, pStrCodalmCRP).toOne();
            
            // ======================================================================
            // En caso no se encuentre en las tablas de Flexline, buscar en Axional.  
            // ======================================================================
            if(!mObjCodalmAxional.codalm_axional){
                var mStrCodAlmAxional = Ax.db.executeGet(`
                        <select >
                            <columns>            
                                codigo
                            </columns>
                            <from table='galmacen'/> 
                            <where>
                                    galmacen.codigo = ?
                                AND galmacen.estado = 'A'
                                AND (galmacen.fecbaj IS NULL OR galmacen.fecbaj &gt;= <today />) 
                            </where>
                        </select>
                    `, pStrCodalmCRP);
                    
                if (mStrCodAlmAxional) {
                    throw `Almacén : [${mStrCodAlmAxional}] nuevo. Registrar en crp_flex_gen_almacen con su respectiva cuenta`
                }     
            }
        }        

        return mObjCodalmAxional;
    } 

    /**
     * LOCAL FUNCTION: __getUnidadMedida
     * 
     * Función local que obtiene unidad de medida del artículo.
     * 
     *      @param   {string}   pStrCodUnidadCRP   Código unidad de medica CRP          
     * 
     */ 
     function __getUnidadMedida(pStrCodUnidadCRP){ 

        // =============================================================    
        // Se obtiene código de unidad de medida Axional desde Flexline
        // ============================================================= 
        var mStrUndMedida = Ax.db.executeGet (`
                <select>
                    <columns>coduni_axional</columns>
                    <from table='crp_flex_unidadproducto' />
                    <where>
                        codigo = ?
                    </where>
                </select>`, pStrCodUnidadCRP);

        // ======================================================================
        // En caso no se encuentre en las tablas de Flexline, buscar en Axional.  
        // ======================================================================
        if (!mStrUndMedida) {
            mStrUndMedida = Ax.db.executeGet (`
                <select>
                    <columns>coduni</columns>
                    <from table='gart_unimed' />
                    <where>
                        coduni = ?
                    </where>
                </select>`, pStrCodUnidadCRP);
        }
            
        if (!mStrUndMedida) {throw `Unidad de medida: [${pStrCodUnidadCRP}] no contemplado`}
        
        //Agregar código para validar unidad de medida venta

        return mStrUndMedida;
    } 

    /**
     * LOCAL FUNCTION: __getTransLogisticaHead
     * 
     * Función local que obtiene datos de la guía interna(Orden de producción ).         
     * y la transfomación
     */ 
    function __getTransLogisticaHead(mStrNumGuia){ 

        return  Ax.db.executeQuery(`
                    <select>
                        <columns>
                            h.trfh_seqno,
                            g.idguiainterna
                        </columns>
                        <from table='crp_crpi_guia_interna' alias='g'>
                            <join table='glog_transflog_head' alias='h'>
                                <on>g.cabdes = h.trfh_seqno</on> 
                            </join>
                        </from>
                        <where>
                            g.numeroguia = ?
                            AND g.idtipotransaccion IN(13, 14)      <!-- idtipotransaccion (13, 14) = Orden de producción -->
                            AND g.estado = 0                      <!-- Estado 0 = Pendiente --> 
                        </where>
                    </select>`, mStrNumGuia).toOne(); 
    } 

    /**
     * LOCAL FUNCTION: __getGuiaInterna
     * 
     * Función local que obtiene datos de la guía interna.         
     * 
     */ 
    function __getGuiaInterna(mStrNumeroGuia, mSqlCondicion){ 

        return  Ax.db.executeQuery(`
                    <select>
                        <columns>
                            c.idguiainterna,
                            d.idguiainternadetalle,
                            c.idtipotransaccion,
                            d.codigoproducto codart,
                            d.cantidad,
                            d.unidadingreso
                        </columns>
                        <from table='crp_crpi_guia_interna' alias='c'>
                            <join table='crp_crpi_guia_interna_detalle' alias='d'>
                                <on>c.idguiainterna = d.idguiainterna</on>
                            </join>
                        </from>
                        <where>
                                c.numeroguia = ?
                            AND c.estado = 0
                            ${mSqlCondicion}
                        </where>
                    </select>`, mStrNumeroGuia).toMemory(); 
    } 

    /**
     * LOCAL FUNCTION: __validateOrigenDestino
     * 
     * Función local donde valida que coincidan datos de las guías internas con la transformación logística origen y destino .         
     * 
     */ 
    function __validateOrigenDestino(mStrTable, mObjValidate){ 
        
        var mStrTableValidate =  mStrTable == 'ORIGEN' ? 'glog_transflog_ori' : 'glog_transflog_dst';  

        var mIntCountReceta = Ax.db.executeGet(`
            <select>
                <columns>
                    COUNT(*)
                </columns>
                <from table='${mStrTableValidate}'/> 
                <where>
                    trfh_seqno = ?
                </where>
            </select>`, mObjValidate.idtransformacionlogistica);    

        if (!mIntCountReceta) {
            throw `Artículo [${mObjValidate.codart}] no tiene receta registrada en Axional.`;
        }

        if(mIntCountReceta != mObjValidate.cantidaditems ){
            throw `Cantidad items de receta [${mObjValidate.cantidaditems}] diferente a la cantidad recetas en Axional [${mIntCountReceta}]`;
        } 

        if (mStrTable =='ORIGEN') { 

            var mStrOrigen = Ax.db.executeGet(`
                    <select>
                        <columns>
                            trfo_seqno
                        </columns>
                        <from table='glog_transflog_ori'/> 
                        <where>
                                trfh_seqno    = ? 
                            AND trfo_codart   = ?
                            AND trfo_coduni   = ?
                            AND trfo_quantity = ?
                        </where>
                    </select>`, mObjValidate.idtransformacionlogistica, mObjValidate.codart, 
                                mObjValidate.unidadmedida,   mObjValidate.cantidad);

            if (!mStrOrigen) {
                throw `Artículo [${mObjValidate.codart}] con unidad de medida [${mObjValidate.unidadmedida}] y cantidad [${mObjValidate.cantidad}] no coincide con la receta registrada en Axional.`;
            } 

            return mStrOrigen;
        }

        if (mStrTable =='DESTINO') { 

            var mStrDestino = Ax.db.executeGet(`
                    <select>
                        <columns>
                            trfd_seqno
                        </columns>
                        <from table='glog_transflog_dst'/> 
                        <where>
                                trfh_seqno    = ? 
                            AND trfd_codart   = ?
                            AND trfd_coduni   = ?
                            AND trfd_quantity = ?
                        </where>
                    </select>`, mObjValidate.idtransformacionlogistica, mObjValidate.codart, 
                                mObjValidate.unidadmedida,   mObjValidate.cantidad);
    
            if (!mStrDestino) {
                throw `Artículo [${mObjValidate.codart}], Und. medida [${mObjValidate.unidadmedida}], cantidad [${mObjValidate.cantidad}] no coincide con  la receta registrada en Axional.`;
            }

            return mStrDestino;
        }
    } 
    
    /**
     * LOCAL FUNCTION: __validateGean
     * 
     * Función local donde valida que el codigo producto, unidad de medida a devolver coincida con la
     * guía interna entregada.         
     * Valída que la cantidad a devolver no sea mayor a la entregada.
     */ 
    function __validateGean(mObjGuiaDetalle){ 
         
        var unidadAxional = '' 

        // ==================================================================================
        // Mapa de de los tipos de transacción : (devolución / entrega) y (entrada / salida) 
        // ==================================================================================
        var mMapTipoTransaccion = new Map();
                mMapTipoTransaccion.set(3, 4);      //  3: FAR DEVOLUCION DE CONSUMOS,          4: FAR ENTREGA DE CONSUMOS 
                mMapTipoTransaccion.set(5, 9);      //  5: G/DEVOLUCION FARMACIA (AMB-EME),     9: O/ENTREGA FARMACIA (AMB-EME)
                mMapTipoTransaccion.set(6, 10);     //  6: O/DEVOLUCION FARMACIA (HOS),        10: O/ENTREGA FARMACIA (HOS)
                mMapTipoTransaccion.set(7, 11);     //  7: O/DEVOLUCION FARMACIA SEDE/TERCERO, 11: O/ENTREGA FARMACIA SEDE/TERCERO
                mMapTipoTransaccion.set(18, 19);    // 18: TRANSF ENTRADA,                     19: TRANSF SALIDA
    
        // ===================================================================================
        // Validar que el tipo de transacción(devolución/entrada) corresponda (entrega/salida)  
        // ===================================================================================
        if(mMapTipoTransaccion.get(mObjGuiaDetalle.idtipotransaccion) != mObjGuiaDetalle.idtipotransaccionorigen){
            
            throw `Id tipo de transacción origen:[${mObjGuiaDetalle.idtipotransaccionorigen}] debe ser :[${mMapTipoTransaccion.get(mObjGuiaDetalle.idtipotransaccion)}]`
            
        } 
    
        // =============================================================================================
        // Obtener movimiento que se realizó la entrega/salida y se está realizando devolución/entrada
        // =============================================================================================
        var mObjGeanmov =  Ax.db.executeQuery(`
                <select>
                    <columns>
                        g.idguiainterna,
                        g.idtipotransaccion,
                        d.linid,
                        d.codart,
                        d.canmov cantidadorigen,
                        d.udmori unidadmedida
                    </columns>
                    <from table='geanmovh' alias='c'>
                        <join table='geanmovl' alias='d'>
                            <on>c.cabid = d.cabid</on>
                        </join>
                        <join table='crp_crpi_guia_interna' alias='g'>
                            <on>c.refter = g.numeroguia</on>
                        </join>
                    </from>
                    <where>
                            g.idtipotransaccion = ?
                        AND g.idtransaccion = ?
                        AND g.numeroguia = ?
                        AND d.codart = ?
                        AND g.estado = 1
                        AND c.estcab = 'V'
                    </where>
                </select>`, mObjGuiaDetalle.idtipotransaccionorigen, 
                            mObjGuiaDetalle.idtransaccionorigen,
                            mObjGuiaDetalle.numeroguiaorigen, 
                            mObjGuiaDetalle.codigoproducto).toOne(); 

        var mIntCantDevuelta =  Ax.db.executeGet(`
                <select>
                    <columns>
                        nvl(sum(d.canmov), 0)
                    </columns>
                    <from table='geanmovl' alias='d'>
                        <join table='crp_crpi_guia_interna_detalle' alias='g'>
                            <on>d.linid = g.lindes</on>
                        </join>
                    </from>
                    <where>
                            g.idtipotransaccionorigen = ?
                        AND g.idtransaccionorigen = ?
                        AND g.numeroguiaorigen = ?
                        AND d.codart = ?
                        AND g.lindes IS NOT NULL
                    </where>
                </select>`, mObjGuiaDetalle.idtipotransaccionorigen, 
                            mObjGuiaDetalle.idtransaccionorigen,
                            mObjGuiaDetalle.numeroguiaorigen, 
                            mObjGuiaDetalle.codigoproducto);
        
        if (!mObjGeanmov.codart) {
            throw `No existe registro para el producto:[${mObjGuiaDetalle.codigoproducto}] - Id. transacción origen:[${mObjGuiaDetalle.idtransaccionorigen}] - Id. tipo transacción origen:[${mObjGuiaDetalle.idtipotransaccionorigen}] - Número guia origen:[${mObjGuiaDetalle.numeroguiaorigen}]`
        } 
        
        if (mObjGuiaDetalle.cantidad > mObjGeanmov.cantidadorigen - mIntCantDevuelta) {
            throw `Artículo [${mObjGuiaDetalle.codigoproducto}] con cantidad a devolver [${mObjGuiaDetalle.cantidad}] supera al disponible [${mObjGeanmov.cantidadorigen - mIntCantDevuelta}] .`
        }
        
        unidadAxional = __getUnidadMedida(mObjGuiaDetalle.unidadingreso);
        
        if (unidadAxional !=  mObjGeanmov.unidadmedida){
            throw `Artículo [${mObjGuiaDetalle.codigoproducto}] con unidad de medida[${unidadAxional}] diferente a la unidad informada en origen [${mObjGeanmov.unidadmedida}] .`
        } 
    } 

    /**
     * LOCAL FUNCTION: __procesarTransLogistica
     * 
     * Función local que procesa la transformación logística generando el movimiento interno.         
     * 
     */ 
    function __procesarTransLogistica(mIntIdTransLogistica){ 

        var mObjMovEan = Ax.db.executeScriptOrQuery(`
                <call name='glog_transflog_head_process_1' into='m_cabean, m_docser'>
                    <args>
                        <arg>${mIntIdTransLogistica}</arg>
                    </args>
                </call>
            `).toOne();

        return  mObjMovEan;   
    } 

    /**
     * LOCAL FUNCTION: __updatedDataControl
     * 
     * Función local que actualiza el movimiento interno 
     * y los datos de control de la guia interna cabecera.         
     * Dependiendo del caso actualiza la línea de la guia interna detalle.
     */ 
    function __updatedDataControl(mObjDataUpdate){ 

        if (mObjDataUpdate.updateean == 'SI') {

            // ===============================================================
            // Actualiza el movimiento interno  a no modificable
            // y el indicador de CRP integrado = [1], refter = numeroguia
            // ===============================================================
            Ax.db.update('geanmovh', {indmod: 'N', auxnum5: 1, refter : mObjDataUpdate.numeroguia, fecrec : mObjDataUpdate.fecharecepcion}, {cabid: mObjDataUpdate.cabid});
        } 

        Ax.db.update('crp_crpi_guia_interna', 
            {
                tabdes            : mObjDataUpdate.tabdes, 
                cabdes            : mObjDataUpdate.cabid,
                estado            : mObjDataUpdate.estado,
                user_processed    : Ax.ext.user.getCode(),
                date_processed    : new Ax.util.Date()
            }, 
            {numeroguia : mObjDataUpdate.numeroguia, estado : '0' }
        ); 

        if (mObjDataUpdate.updateguiadetalle == 'SI') {

            // ===============================================================
            // Actualiza datos de control la guia interna detalle.
            // =============================================================== 
            var mRsGeanmovl = Ax.db.executeQuery(`
                    <select>
                        <columns> 
                            geanmovl.linid,
                            geanmovl.codart
                        </columns>
                        <from table='geanmovl'/>
                        <where>
                            cabid = ?
                        </where>
                    </select>`, mObjDataUpdate.cabid).toMemory();
            
            for(var mRowGeanmovl of mRsGeanmovl){

                Ax.db.update('crp_crpi_guia_interna_detalle', 
                    {
                        tabdes            : 'geanmovl', 
                        cabdes            : mObjDataUpdate.cabid,
                        lindes            : mRowGeanmovl.linid
                    }, 
                    {   
                        idguiainterna     : mObjDataUpdate.idguiainterna,
                        codigoproducto    : mRowGeanmovl.codart,
                    }
                ); 
            }  
        } 
    }

    /**
     * LOCAL FUNCTION: __insertGean
     * 
     * Función local que inserta el movimiento interno cabecera y detalle 
     */ 
    function __insertGean(mObjDataEan, mArrGuiaInternaDetalle, mObjData, mObjDataUpdateGuia){   
                 
        // ===============================================================
        // Inserta cabecera del movimiento interno.  
        // =============================================================== 

        var mIntCabmov = Ax.db.executeFunction('geanmovh_inserta',
            [ 
                null,                                                                // Delegación            
                null,                                                                // Departamento          
                mObjDataEan.codalmori,                                               // Almacén origen            //Test 'CRP0282P'         
                mObjDataEan.codalmdst,                                               // Almacén destino           //Test 'CRP0121A'   
                mObjDataEan.tipdoc,                                                  // Tipo documento        
                mObjDataUpdateGuia.fecharecepcion,                                   // Fecha movimiento . Se considera la fecha de la gúia interna.              
                null,                                                                // Numero de movimiento  
                mObjData.numeroguia,                                                 // Referencia  refter                
                null,                                                                // Documento origen                       
                null,                                                                // Origen auxiliar       
                null,                                                                // Tercero reexpedición   
                null,                                                                // Dir. reexpedición          // Revisar si todos tienen que ser 0 (direccion fiscal)   
                null,                                                                // Notas                                   
                0,                                                                   // RF 1/1                
                'S'                                                                  // Ind. modificar
            ]       
        ).toValue();
    
        // ===============================================================
        // Valida si se ha generado el movimiento.
        // ===============================================================
        mStrDocser = Ax.db.executeGet(`
            <select>
                <columns> 
                    docser
                </columns>
                <from table='geanmovh' />
                <where>
                    cabid = ?
                </where>
            </select>`, mIntCabmov);
        
        if (!mStrDocser) {throw `Movimiento Id: [${mIntCabmov}] no encontrado`} 

        mObjDataUpdateGuia.cabid = mIntCabmov; 
        mObjDataUpdateGuia.idguiainterna = mIntIdGuia;
        mObjDataUpdateGuia.updateguiadetalle = 'NO'; 
    
        // ===============================================================
        // Actualizar movimiento interno y guia interna cabecera.
        // =============================================================== 
        __updatedDataControl(mObjDataUpdateGuia); 
    
        var mStrLote = '0';
        // ===============================================================
        // Inserta línea de movimiento interno.
        // =============================================================== 
        for (var mObjGuiaDetalle of mArrGuiaInternaDetalle) { 
            
            var mIntCodProveedor = 0; 
    
            // ===============================================================
            // Validar devoluciones y transferencias de entrada
            // =============================================================== 
            if(mObjData.idtipotransaccion == 3 || mObjData.idtipotransaccion == 5 || 
                mObjData.idtipotransaccion == 6 || mObjData.idtipotransaccion == 7 || mObjData.idtipotransaccion == 18){
                
                mObjGuiaDetalle.idtipotransaccion = mObjData.idtipotransaccion;
    
                __validateGean(mObjGuiaDetalle); 
    
            }
    
            if(mObjGuiaDetalle.rucconsignador && mObjDataEan.flagterdep == 'S'){
    
                // ===================================================================================
                // Obtener código y validar el Ruc del consignador sea el mismo del artículo proveedor 
                // =================================================================================== 
                mIntCodProveedor = __getCodigoConsignador(mObjGuiaDetalle);
            } 

            if (mObjGuiaDetalle.lote) {
                mStrLote = mObjGuiaDetalle.lote; 
            }
    
            // ===============================================================
            // Valida que se inserte solo las cantidades positivas.
            // =============================================================== 
            if (mObjGuiaDetalle.cantidad > 0) {
    
                // =================================================================
                // Setear datos requeridos para crear línea de movimiento interno.
                // =================================================================
                let mObjGeanmovl = {
                    linid   : 0,
                    cabid   : mIntCabmov,
                    codean  : 0, 
                    codart  : mObjGuiaDetalle.codigoproducto,                    // codart: 000015
                    varstk  : 0,
                    desvar  : null,
                    numlot  : mStrLote,
                    canmov  : mObjGuiaDetalle.cantidad,                          // cantidad a Reajustar o transferir
                    canalt  : null,                                              // cantidad alternativa
                    udmori  : __getUnidadMedida(mObjGuiaDetalle.unidadingreso),  // Unidad de medida del artículo                 
                    udmalt  : null,
                    terdep  : mIntCodProveedor,                                  // Colocar 0 por default
                    ubiori  : 0,
                    ubides  : 0,
                    precio  : mObjGuiaDetalle.precio,                            // Precio del artículo
                    canabo  : 0,
                    canrec  : 0,
                    indmod  : 'N',
                    linori  : null
                }
    
                var mIntLinmov = Ax.db.insert("geanmovl", mObjGeanmovl).getSerial(); 
    
                // =================================================================
                // Actualiza datos de control del detalle de la guía interna.
                // =================================================================   
                Ax.db.update('crp_crpi_guia_interna_detalle', 
                    {   
                        tabdes : 'geanmovl', 
                        cabdes : mIntCabmov, 
                        lindes : mIntLinmov
                    }, 
                    {idguiainternadetalle: mObjGuiaDetalle.idguiainternadetalle}
                ); 
            } 
        }
        
        // ===============================================================
        // Validar el movimiento interno generado.
        // ===============================================================
        Ax.db.call('geanmovh_Valida', mIntCabmov); 

        return mIntCabmov;
    }
    
    /**
     * LOCAL FUNCTION: __getCodigoConsignador
     * 
     * Función local Obtiene el cógido del consignador y valida que tenga el artículo asociado
     * en geartprov.         
     * 
     */ 
    function __getCodigoConsignador(mObjGuiaDetalle){               
        // =======================================================================
        // Validar que el Ruc del consignador sea el mismo del artículo proveedor 
        // ======================================================================= 
        mIntCodProveedor = Ax.db.executeGet(`
            <select>
                <columns> 
                    gartprov.codpro
                </columns>
                <from table='gartprov'>
                    <join table='ctercero'>
                        <on>gartprov.codpro = ctercero.codigo</on>
                    </join> 
                </from>
                <where>
                        codart = ?
                    AND ctercero.cif = ?
                    AND gartprov.estado = 'A' 
                    AND (gartprov.fecbaj IS NULL OR gartprov.fecbaj &gt;= <today />)
                </where>
            </select>`, mObjGuiaDetalle.codigoproducto, mObjGuiaDetalle.rucconsignador);
        
        if (!mIntCodProveedor) {throw `Consignador RUC: [${mObjGuiaDetalle.rucconsignador}] no tiene asociado el artículo ó está de baja [${mObjGuiaDetalle.codigoproducto}]`};
    
        return mIntCodProveedor;
    }

    /**
     * LOCAL FUNCTION: __insertAlbaranCompra
     * 
     * Función local que crea albarán de compras desde un pedido de compra 
     * 
     */ 
    function __insertAlbaranCompra(mIntCabped){ 

        // ===============================================================
        // Obtener datos del pedido de compras
        // =============================================================== 
        var mObjDocori = Ax.db.executeQuery(`
            <select>
                <columns>
                    gcompedh.delega, gcompedh.depart, gcompedh.tercer,
                    gcompedh.tipdir, gcompedh.divisa, gcompedh.cambio,
                    gcompedh.tipefe, gcompedh.frmpag, gcompedh.terenv,
                    gcompedh.direnv, gcompedh.terexp, gcompedh.direxp,
                    gcompedh.numexp, gcompedh.portes, gcompedh.terfac,
                    gcompedh.dirfac, gcompedh.dtogen, gcompedh.dtopp,
                    gcompedh.porgar, gcompedh.clasif, gcompedh.refter,
                    gcompedh.nommos, gcompedh.direcc, gcompedh.codnac,
                    gcompedh.nomnac, gcompedh.codpos, gcompedh.poblac,
                    gcompedh.codprv, gcompedh.nomprv, gcompedh.telef1,
                    gcompedh.telef2, gcompedh.fax,    gcompedh.email,
                    gcompedh.codpre, gcompedh.codpar, gcompedh.estcab,
                    gcompedh.codalm, gcompedh.fecha,  gcompedh.docser 
                </columns>
                <from table='gcompedh' />
                <where>
                    gcompedh.cabid = ?
                </where>
            </select>`, mIntCabped).toOne();

        if (mObjDocori.estcab != 'V') {
            throw `Pedido de compras no validado cabid [${mIntCabped}]`
        } 

        let mObjGcommovh = {
            tipdoc : 'AFAI',
            docori : mObjDocori.docser,
            fecmov : mObjDocori.fecha,
            //fecrec : pObjGeanmovh.fecrec,
            almori : mObjDocori.codalm,
            delega : mObjDocori.delega,
            depart : mObjDocori.depart,
            tercer : mObjDocori.tercer,
            tipdir : '0',
            divisa : mObjDocori.divisa,
            cambio : mObjDocori.cambio,
            tipefe : mObjDocori.tipefe,
            frmpag : mObjDocori.frmpag,
            terenv : mObjDocori.terenv,
            direnv : mObjDocori.direnv,
            terexp : mObjDocori.terexp,
            direxp : mObjDocori.direxp,
            numexp : mObjDocori.numexp,
            portes : mObjDocori.portes,
            terfac : mObjDocori.terfac,
            dirfac : mObjDocori.dirfac,
            dtogen : mObjDocori.dtogen,
            dtopp  : mObjDocori.dtopp,
            porgar : mObjDocori.porgar, 
            clasif : mObjDocori.clasif,
            refter : mObjDocori.refter,
            coment : null,
            nommos : mObjDocori.nommos,
            direcc : mObjDocori.direcc,
            codnac : mObjDocori.codnac,
            nomnac : mObjDocori.nomnac,
            codpos : mObjDocori.codpos,
            poblac : mObjDocori.poblac, 
            codprv : mObjDocori.codprv,
            nomprv : mObjDocori.nomprv,
            telef1 : mObjDocori.telef1,
            telef2 : mObjDocori.telef2,
            fax    : mObjDocori.fax,
            email  : mObjDocori.email,
            codpre : mObjDocori.codpre,
            codpar : mObjDocori.codpar,
            indmod : 'N'
        }

        // ====================================================================
        // Crear albarán de compras con los datos del pedido de compra
        // ====================================================================         
        mIntCabdes = Ax.db.call('gcommovh_Insert', 'GCOMPEDH', mObjGcommovh);


        // =====================================================================
        // Copiar líneas del pedido de compras -> líneas del albarán de compras
        // ===================================================================== 
        __insertGcompedlGcommovl(mObjGcommovh, mIntCabped, mIntCabdes)

        // ======================================================================
        // Establecer el estado principal de los pedidos de origen
        // ======================================================================
        Ax.db.executeProcedure("gcompedl_set_head_estado", mIntCabped);

        // ===============================================================
        // Validar albarán de compras.
        // ===============================================================
        Ax.db.call("gcommovh_Valida", mIntCabdes); 

        // ===============================================================
        // Controlar que esté validado el albarán de compras
        // =============================================================== 
        var mStrEstadoAlbCompra = Ax.db.executeGet(`
                <select>
                    <columns>estcab</columns>
                    <from table='gcommovh'/> 
                    <where>
                        cabid = ?
                    </where>
                </select>
        `,mIntCabdes);

        if (mStrEstadoAlbCompra != 'V') {
            throw `Albarán de compras no validado`
        }  
    }

    /**
     * LOCAL FUNCTION: __insertGcompedlGcommovl
     * 
     * Función local que copia las líneas del pedido de compra a las líneas
     * del albará de compras. 
     * 
     */ 
    function __insertGcompedlGcommovl(mObjGcommovh, mIntCabped, mIntCabdes) { 

        // ===============================================================
        // Guardar datos recibidos del API (Cabecera y detalle).  
        // =============================================================== 
        Ax.db.update("gcompedh", {post_hupd: 1 }, {cabid : mIntCabped});
    
        // ===============================================================
        // Obtener líneas del pedido de compra.                                         
        // ===============================================================
        var mRsGcompedl = Ax.db.executeQuery(`
            <select>
                <columns>
                    gcompedl.orden,  gcompedl.codart,
    
                    CASE WHEN gcompedl.varlog IS NOT NULL
                            THEN gcompedl.varlog
                            ELSE gartvarl_get_comvldef(
                                    ? ,
                                    ? ,
                                    ? ,
                                    gcompedl.codart)
                        END varlog,
    
                    gcompedl.desvar, gcompedl.numlot,        gcompedl.canped,
                    gcompedl.canped canmov, gcompedl.udmcom, gcompedl.canpre,
                    gcompedl.udmpre, gcompedl.canalt, gcompedl.udmalt, 
                    gcompedl.precio, gcompedl.dtoli1, gcompedl.dtoli2,
                    gcompedl.dtoli3, gcompedl.dtoimp, gcompedl.pretar,
                    gcompedl.dtotar, gcompedl.terexp, gcompedl.direxp,
                    gcompedl.desamp, gcompedl.regalo, 'N' indmod,
                    gcompedl.linacu, gcompedl.linid linori,
                    gcompedl.canbon, gcompedl.linrel,
                    gcompedl.cabid cabori,
                    'gcompedh'     tabori,
                    garticul.lotes
                </columns>
                <from table="gcompedl">
                    <join table="garticul">
                        <on>gcompedl.codart = garticul.codigo</on>
                    </join> 
                </from>
                <where>
                    gcompedl.cabid = ?
                </where>
                <order>gcompedl.linid</order>
            </select>`, mObjGcommovh.almori, mObjGcommovh.tercer, mObjGcommovh.tipdir, mIntCabped); 
    
        for(var mRowGcompedl of mRsGcompedl){
            
            mRowGcompedl.cabid = mIntCabdes;
            mRowGcompedl.ubiori = '0';
            mRowGcompedl.ubides = '0';

            // ===============================================================
            // Crear líneas de albarán de compra.                                         
            // ===============================================================   
            Ax.db.insert("gcommovl", mRowGcompedl);
    
        } 
    }

    // ===============================================================
    // Guardar datos recibidos del API (Cabecera y detalle).  
    // ===============================================================
    try {
        Ax.db.beginWork();

        var mIntTransaccion = 0;

        var mStrDocser = 0;

        var mObjData = pObjData; 

        var mObjKitDetalle = {componenteso:[], componentesd:[]};

        var mObjComponentes = {}; 
        
        var mIntEstado = 1; // 0: Pendiente , 1: Integrado c/ movimiento

        var mDateFechaGuia = (new Ax.util.Date(mObjData.fechaguia)).format("dd-MM-yyyy");  // Fecha de la guía interna

        var mObjDataUpdateGuia = {tabdes : 'geanmovh', fecharecepcion : mDateFechaGuia , updateguiadetalle : 'SI', updateean : 'SI', numeroguia : mObjData.numeroguia, estado : mIntEstado}; 

        var mStrReposicion = '';

        var mObjDataEan = {flagterdep : 'S'};

        var mObjRequest = {};

        var mStrMensajeError = '';
        
        var mStrMensajeResult = 'Error Al realizar la transacción';
        
        var mStrMensaje = 'Transacción realizada correctamente'; 

        var mArrGuiaInternaDetalle = mObjData.guiainternadetalle;
        
        // =============================================================
        // Guardar Json recibido y agregar fecha recibida.
        // ============================================================= 
        mObjData.json_guia_interna =  JSON.stringify(pObjData);
        mObjData.date_received     = new Ax.util.Date();
        
        // =============================================================
        // Insertar guia interna cabecera.
        // =============================================================  
        var mIntIdGuia = Ax.db.insert('crp_crpi_guia_interna', mObjData).getSerial();
  
        // =============================================================
        // Insertar guia interna detalle.
        // ============================================================= 
        for (var mObjDetalleGuia of mArrGuiaInternaDetalle) { 
            
            mObjDetalleGuia.idguiainterna        = mIntIdGuia; 
            mObjDetalleGuia.idguiainternadetalle = 0;
            mObjDetalleGuia.date_received        = new Ax.util.Date();
            
            var mIntIdGuiaDetalle = Ax.db.insert('crp_crpi_guia_interna_detalle', mObjDetalleGuia).getSerial();
            
            mObjDetalleGuia.idguiainternadetalle = mIntIdGuiaDetalle; 

            // ====================================================================================
            // Obtener datos para KITS . 13 = O/P COMPONENTES (Orden de producción) BAJA
            // Obtener datos para KITS . 14 = O/P KITS (Orden de producción) ALTA
            // Obtener datos para KITS . 15 = O/PRODUCCION MULTIDOSIS - Transferencias(fraccionado)
            // ====================================================================================
            if (mObjData.idtipotransaccion == 13 || mObjData.idtipotransaccion == 14 || mObjData.idtipotransaccion == 15) {
                if (mObjDetalleGuia.cantidad < 0) {

                    mObjComponentes =  { 
                                            idguiainternadetalle  : mIntIdGuiaDetalle,
                                            codart                : mObjDetalleGuia.codigoproducto,
                                            cantidad              : Math.abs(mObjDetalleGuia.cantidad),
                                            unidadmedida          : __getUnidadMedida(mObjDetalleGuia.unidadingreso)
                                        }
                    mObjKitDetalle.componenteso.push(mObjComponentes)                        
                }else{
                    mObjComponentes =  {
                                            idguiainternadetalle  : mIntIdGuiaDetalle,
                                            codart                : mObjDetalleGuia.codigoproducto,
                                            cantidad              : Math.abs(mObjDetalleGuia.cantidad),
                                            unidadmedida          : __getUnidadMedida(mObjDetalleGuia.unidadingreso)
                                        }
                    mObjKitDetalle.componentesd.push(mObjComponentes)
                }
            }

            // =================================================================
            // Obtener datos para KITS . 16 P/E COMPONENTES (alta stock)
            // Obtener datos para KITS . 17 P/E KITS Producción (alta stock)
            // =================================================================
            if (mObjData.idtipotransaccion == 16 || mObjData.idtipotransaccion == 17) { 

                mObjComponentes =  {
                                        idguiainternadetalle  : mIntIdGuiaDetalle,
                                        codart                : mObjDetalleGuia.codigoproducto,
                                        cantidad              : Math.abs(mObjDetalleGuia.cantidad), 
                                        unidadmedida          : __getUnidadMedida(mObjDetalleGuia.unidadingreso)
                                    }
                mObjKitDetalle.componentesd.push(mObjComponentes);
              
            }

            // =================================================================
            // Obtener datos para KITS . 21 V/C COMPONENTES  (baja stock)
            // Obtener datos para KITS . 22 V/C KITS  (baja stock)
            // =================================================================
            if (mObjData.idtipotransaccion == 21 || mObjData.idtipotransaccion == 22) { 

                mObjComponentes =  {
                                        idguiainternadetalle  : mIntIdGuiaDetalle,
                                        codart                : mObjDetalleGuia.codigoproducto,
                                        cantidad              : Math.abs(mObjDetalleGuia.cantidad),
                                        unidadmedida          : __getUnidadMedida(mObjDetalleGuia.unidadingreso)
                                    }
                mObjKitDetalle.componenteso.push(mObjComponentes);
          
            }
        } 

        // =================================================================
        // Guardar cantidad de items de los componentes 
        // ================================================================= 
        mObjKitDetalle.cantidaditemso = mObjKitDetalle.componenteso.length;
        mObjKitDetalle.cantidaditemsd = mObjKitDetalle.componentesd.length; 

        Ax.db.commitWork();

    } catch (error) {

        Ax.db.rollbackWork(); 
        
        mStrMensajeError = `ERROR [${error.message || error}]`;
        
        mObjRequest =  { response : { code    : '406',
                                      message : `${mStrMensajeError}`
                                   }
                        };
        
        return new Ax.net.HttpResponseBuilder()            
        .status(406)
        .entity(mObjRequest)
        .type("application/json")
        .build();
    }

    // ===============================================================
    // Inicio de la transacción.  
    // ===============================================================    
    try {    

        Ax.db.beginWork();

        // ===========================================================
        // Obtener tipología de Axional y el grupo de transacción.
        // =========================================================== 
        var mObjTipoGuia = Ax.db.executeQuery(`
                <select>
                    <columns>
                        tipgi_tipdoc_axional, 
                        tipgi_grupo
                    </columns>
                    <from table='crp_crpi_tipo_guia_interna' />
                    <where>
                        tipgi_tipdoc_crpi = ? AND
                        tipgi_estado = 'A'
                    </where>
                </select>`, mObjData.idtipotransaccion).toOne();
        
        var mStrTipologia = mObjTipoGuia.tipgi_tipdoc_axional;
        var mStrGrupoTransaccion = mObjTipoGuia.tipgi_grupo;    
            
        if(!mStrTipologia){throw "Tipo de guía no contemplado."}    
                
        var mObjAlmacenOri = {};
        var mObjAlmacenDes = {};
        
        if(mObjData.codigoalmacen){
            
            // ===========================================================
            // Obtener almacén Origen.
            // ===========================================================
            mObjAlmacenOri = __getAlmacen(mObjData.codigoalmacen);

            if (!mObjAlmacenOri.codalm_axional) {throw `Almacén origen: [${mObjData.codigoalmacen}] no encontrado`} 

            // ===========================================================
            // 3 : FAR. DEVOLUCION DE CONSUMOS 
            // 4 : FAR. ENTREGA DE CONSUMOS
            // ===========================================================
            if (mObjData.idtipotransaccion == 3 || mObjData.idtipotransaccion == 4){
                // ===========================================================
                // Obtener almacén Destino desde el código de punto de consumo.
                // =========================================================== 
                if(mObjData.codigopuntoconsumo && mObjData.codigopuntoconsumo != 'NULL'){
                    
                    mObjAlmacenDes = __getAlmacen(mObjData.codigopuntoconsumo);
                    
                }else{
                    throw `Guia Nro : [${mObjData.numeroguia}] no tiene informado el código punto de consumo`
                } 
            }

            if(mObjData.codigoalmacendestino && mObjData.codigoalmacendestino != 'NULL'){

                // ==============================================================
                // Obtener almacén Destino desde el campo código almacén destino.
                // ==============================================================    
                mObjAlmacenDes = __getAlmacen(mObjData.codigoalmacendestino);

                if (!mObjAlmacenDes.codalm_axional) {throw `Almacén destino: [${mObjData.codigoalmacendestino}] no encontrado`} 

            } 
        } 

        // ===============================================================
        // Transacciones de tipo consumo, venta y transferencia.  
        // ===============================================================
        if(mStrGrupoTransaccion == 'CONSUMO' || mStrGrupoTransaccion == 'VENTA' || mStrGrupoTransaccion == 'TRANSFER'){

            // ===============================================================
            // Validar que el número de guía no tenga movimiento generado.
            // ===============================================================
            var mIntExistGuia = Ax.db.executeGet(`
                    <select>
                        <columns> 
                            COUNT(*)
                        </columns>
                        <from table='geanmovh' />
                        <where>
                            refter = ?
                        </where>
                    </select>`, mObjData.numeroguia);
            
            if (mIntExistGuia > 0) {throw `Guia Nro : [${mObjData.numeroguia}] ya tiene movimiento generado.`} 

            // ===============================================================
            // Transacciones de tipo consignaciones 
            // 8: O/ENTREGA CONSIGNADOS (HOS) 
            // =============================================================== 
            if (mObjData.idtipotransaccion == 8) { 

                var mStrLote = '0'; 
                var mIntCantidad = 0;

                for (var mRowGuiaDetalle of mArrGuiaInternaDetalle) { 

                    // =============================================================
                    // Obtener código del consignador .
                    // ============================================================= 
                    var mStrCodigoConsignador = __getCodigoConsignador(mRowGuiaDetalle); 

                    var mStrGuiaConsignador = mRowGuiaDetalle.guiaconsignador; 

                    if (mRowGuiaDetalle.lote) {
                        mStrLote = mRowGuiaDetalle.lote; 
                    }

                    mIntCantidad = mRowGuiaDetalle.cantidad;

                    var mObjGcomalbh = Ax.db.executeQuery(`
                            <select>
                                <columns> 
                                    gcomalbl.linid,
                                    gcomalbl.canmov,
                                    gcomalbl.codart,
                                    gcomalbh.almori
                                </columns>
                                <from table='gcomalbh'>
                                    <join table='gcomalbl'>
                                        <on>gcomalbh.cabid = gcomalbl.cabid</on>
                                    </join>
                                </from>
                                <where>
                                        gcomalbh.refter = ?
                                    AND gcomalbh.tercer = ?
                                    AND gcomalbl.codart = ?
                                    AND gcomalbl.numlot = ?
                                    AND gcomalbh.estcab = 'V' 
                                    AND gcomalbl.auxchr2 != 'S'
                                </where>
                            </select>`, mStrGuiaConsignador, mStrCodigoConsignador, mRowGuiaDetalle.codigoproducto, mStrLote).toOne(); 
                    
                    if (!mObjGcomalbh.linid) {throw `Guia consignador Nro : [${mStrGuiaConsignador}] con artículo [${mRowGuiaDetalle.codigoproducto}] no tiene albarán de compra.`}; 
                    
                } 
                
                if(mObjGcomalbh.almori){

                    // =============================================================
                    // Obtener tipo de almacén consignador.
                    // galmacen.auxfec1 = 'I' -> Individual
                    // galmacen.auxfec1 = 'M' -> Masivo
                    // galmacen.auxfec1 = 'N' -> Normal
                    // ============================================================= 
                    var mStrTipoAlmacen = Ax.db.executeQuery(`
                            <select>
                                <columns> 
                                    galmacen.auxfec1
                                </columns>
                                <from table='galmacen'/> 
                                <where>
                                        galmacen.codigo = ?
                                    AND galmacen.estado = 'A'
                                    AND (galmacen.fecbaj IS NULL OR galmacen.fecbaj &gt;= <today />)
                                </where>
                            </select>`, mObjGcomalbh.almori).toOne(); 

                    // ===============================================================
                    // Consignaciones individuales 
                    // =============================================================== 
                    if(mStrTipoAlmacen.auxfec1 == 'I'){ 

                        mStrReposicion = 'S';

                        if(!Ax.math.bc.equals(new Ax.math.BigDecimal(mObjGcomalbh.canmov), new Ax.math.BigDecimal(mIntCantidad)) ){
                        
                            throw `Artículo [${mObjGcomalbh.codart}] con cantidad informada [${mIntCantidad}] diferente a la cantidad [${mObjGcomalbh.canmov}] del albarán de compra.`
                        }

                        // =======================================================================================
                        // Inserta EAN cabecera y línea  que mueve stock de Almcacén de consignación al principal
                        // ======================================================================================= 
                        mObjDataEan.tipdoc = 'TCDP'                  // Cuenta DEPO -> DISP 
                        mObjDataEan.codalmori = mObjGcomalbh.almori; // Almacén de consignación (DEPO)
                        mObjDataEan.codalmdst = 'CRP0282P';          // Almacén principal (DISP) 

                        mIntTransaccion = __insertGean(mObjDataEan, mArrGuiaInternaDetalle, mObjData, mObjDataUpdateGuia); 

                        // =================================================================
                        // Actualizar línea del albarán de compra para marcar como consumido
                        // ================================================================= 
                        Ax.db.update('gcomalbl', 
                            {   
                                auxchr2 : 'S'
                            }, 
                            {linid: mObjGcomalbh.linid}
                        ); 
                    }

                    // ===============================================================
                    // Consignaciones Masivas 
                    // =============================================================== 
                    else if(mStrTipoAlmacen.auxfec1 == 'M'){ 

                        // ===================================================================================
                        // Realizar pedido de compra
                        // =================================================================================== 
                        var mIntCabped = null;
                        var mOldTerdep = '';
                        var mIntCodProveedor = ''; 
                        var mStrLote = '0'; 
                        //var mDateFecVencimiento = null;
                        var mObjDocori = null;

                        for (var mObjDetalle of mArrGuiaInternaDetalle) {
                        
                            mIntCodProveedor = __getCodigoConsignador(mObjDetalle); 
                    
                            if (mIntCodProveedor !== mOldTerdep) {
                                
                                if (mIntCabped !== null ) {
                                    
                                    // ===============================================================
                                    // Validar la cabecera
                                    // ===============================================================      
                                    Ax.db.call("gcompedh_Valida", mIntCabped);

                                    // ===============================================================
                                    // Crear albarán de compras
                                    // ===============================================================
                                    __insertAlbaranCompra(mIntCabped);
                                } 

                                // ===============================================================
                                // Obtener unidad de medida de compra
                                // =============================================================== 
                                var mObjGarticul = Ax.db.executeQuery(`
                                        <select>
                                            <columns>          
                                                udmcom,
                                                nomart
                                            </columns>
                                            <from table='garticul'/> 
                                            <where>
                                                codigo=?
                                            </where>
                                        </select>
                                    `, mObjDetalle.codigoproducto).toOne(); 

                                // ===============================================================
                                // Fechas
                                // ===============================================================
                                let mDateFecha =  new Ax.sql.Date(); 

                                let mIntDiadem = Ax.db.executeFunction('gartprov_get_diadem',
                                                    mIntCodProveedor, 'CRP0282P', 
                                                    mObjDetalle.codigoproducto, 0,
                                                    mObjGarticul.udmcom).toValue();
                                    
                                mDateFecent = mDateFecha.addDay(mIntDiadem);
                                
                                // ===============================================================
                                // Inserta pedido de compra cabecera si no existe 
                                // =============================================================== 
                                let mObjGcompedh = {
                                    cabid     : 0,
                                    tipdoc    : "PFAD",
                                    empcode   : 125,
                                    delega    : 'CRP0',
                                    depart    :'282P',
                                    fecha     : mDateFecha,
                                    fecini    : mDateFecha,
                                    fecfin    : mDateFecent,
                                    tercer    : mIntCodProveedor,
                                    tipdir    : "0",
                                    refter    : mObjData.numeroguia,
                                    codalm    : 'CRP0282P'
                                }

                                mIntCabped = Ax.db.call("gcompedh_Insert","gcompedh_GenGcompedh", mObjGcompedh);
                
                                mOldTerdep = mIntCodProveedor;
                                
                            } 

                            if (mObjDetalle.lote) {
                                mStrLote = mObjDetalle.lote; 
                                //mDateFecVencimiento = (new Ax.util.Date(mObjDetalle.fechavencimiento)).format("dd-MM-yyyy")
                            } 
                            
                            Ax.db.insert("gcompedl",
                                {
                                    linid    : 0,
                                    cabid    : mIntCabped,
                                    entini   : mDateFecent,
                                    codart   : mObjDetalle.codigoproducto,
                                    numlot   : mStrLote,
                                    varlog   : 0,
                                    desvar   : mObjGarticul.nomart,
                                    canped   : mObjDetalle.cantidad,
                                    canadj   : 0,
                                    canext   : 0,
                                    canser   : 0,
                                    canfac   : 0,
                                    udmcom   : mObjGarticul.udmcom,
                                    impnet   : 0,
                                    canpre   : mObjDetalle.cantidad,
                                    udmpre   : mObjGarticul.udmcom
                                });

                        }
                        
                        // =======================================================================
                        // Validar cabecera del albarán de compra
                        // Al validar crea un movimiento interno tipdoc :'ENTS' cuenta NSAL - DISP
                        // ======================================================================= 
                        if(mIntCabped !== null) {   

                            Ax.db.call("gcompedh_Valida", mIntCabped);

                            // ===============================================================
                            // Crear albarán de compras
                            // ===============================================================
                            __insertAlbaranCompra(mIntCabped);
                        } 

                        mObjDataEan.flagterdep = 'N';                            // No informar terdep en la línea

                    }else{

                        throw `Almacén [${mObjGcomalbh.almori}] no es de tipo consignación.`
                    } 
                } 

                // ===============================================================
                // Inserta EAN cabecera y línea 
                // =============================================================== 
                mObjDataEan.tipdoc = 'TRAL'                              //Cuenta DISP -> DISP   
                mObjDataEan.codalmori = 'CRP0282P';
                mObjDataEan.codalmdst = mObjAlmacenOri.codalm_axional;   // FAR CTR QUIRURGICO (CRP0290F) 


                var mIntEan = __insertGean(mObjDataEan, mArrGuiaInternaDetalle, mObjData, mObjDataUpdateGuia);

                if (!mIntEan) {
                    throw `Error al crear movimiento interno de traspaso [TRAL]`
                }

                // ===============================================================
                // END Transacciones de tipo consignaciones  
                // =============================================================== 
            } 
                
            // ===============================================================
            // Inserta EAN cabecera y línea según la tabla semaforo 
            // ===============================================================     
            mObjDataEan.tipdoc    = mStrTipologia;
            mObjDataEan.codalmori = mObjAlmacenOri.codalm_axional;
            mObjDataEan.codalmdst = mObjAlmacenDes.codalm_axional;     

            mIntTransaccion = __insertGean(mObjDataEan, mArrGuiaInternaDetalle, mObjData, mObjDataUpdateGuia); 

            // ===============================================================
            // Realizar pedido de compra tipo reposición (PIDE)  
            // =============================================================== 
            if (mObjData.idtipotransaccion == 8 && mStrReposicion) {
                
                Ax.db.call('geanmovh_GenGcompedh_Depo', mIntTransaccion);
                
            }
        }    
        // ===============================================================   
        // Transacciones de tipo KITS
        // ===============================================================
        if(mStrGrupoTransaccion == 'KITS'){

            mIntIdTransLogistica = 0;

            // ================================================================================
            // Controlar que el número de guia y tipo de transacción no se inserten mas de uno.
            // ================================================================================
            var mIntExistCompraKit = Ax.db.executeGet(`
                    <select>
                        <columns> 
                            COUNT(*)
                        </columns>
                        <from table='crp_crpi_guia_interna' />
                        <where>
                                numeroguia = ?
                            AND idtipotransaccion = ?
                            AND estado != 3
                        </where>
                    </select>`, mObjData.numeroguia, mObjData.idtipotransaccion);
            
            if(mIntExistCompraKit > 1 ){throw `Guia Nro : [${mObjData.numeroguia}] con Id. tipo de transacción [${mObjData.idtipotransaccion}] ya se encuentra registrado`}

            // 13 O/P COMPONENTES
            // 14 O/P KITS Orden de producción
            // 15 O/PRODUCCIÓN MULTIDOSIS
            if (mObjData.idtipotransaccion == 13 || mObjData.idtipotransaccion == 14 || mObjData.idtipotransaccion == 15) { 

                // =================================================================
                // Setear datos requeridos para crear Transformación logistica.
                // ================================================================= 
                let mObjTransforLogistica = { 
                    trfh_type     : mStrTipologia,
                    trfh_date     : mDateFechaGuia,
                    trfh_empcode  : 125, 
                    trfh_codalm   : mObjAlmacenOri.codalm_axional, 
                    trfh_status   : 'E',
                    trfh_comment  : null
                }

                mIntIdTransLogistica = Ax.db.insert("glog_transflog_head", mObjTransforLogistica).getSerial(); 
                
                // ====================================================================
                // 13 O/P COMPONENTES
                // ====================================================================
                if (mObjData.idtipotransaccion == 13) { 

                    // ====================================================================
                    // Setear datos requeridos para crear Origen (Explosion / insumo).
                    // ====================================================================
                    for (var mRowComponenteo of mObjKitDetalle.componenteso) {

                        mStrCodArticulo = mRowComponenteo.codart;

                        var mObjTransforOrigen = { 
                            trfo_seqno     : 0,
                            trfh_seqno     : mIntIdTransLogistica, 
                            trfo_codart    : mRowComponenteo.codart,
                            trfo_varlog    : 0,
                            trfo_numlot    : 0,
                            trfo_coduni    : mRowComponenteo.unidadmedida,
                            trfo_quantity  : mRowComponenteo.cantidad
                        }
                        
                        Ax.db.insert("glog_transflog_ori", mObjTransforOrigen).getSerial(); 

                    } 
                    
                    // ==================================================================================
                    // Comprobar que la información obtenida de las recetas coindida con los componentes.
                    // de la orden de producción.  
                    // ================================================================================== 
                    for (var mObjComponented of mObjKitDetalle.componentesd) {

                        mObjComponented.idtransformacionlogistica = mIntIdTransLogistica;
                        mObjComponented.cantidaditems = mObjKitDetalle.cantidaditemsd;

                        __validateOrigenDestino('DESTINO', mObjComponented);

                    } 

                // ====================================================================
                // 14 O/P KITS Orden de producción. ó 15 O/PRODUCCIÓN MULTIDOSIS.
                // ====================================================================    
                } else { 
                    // ====================================================================
                    // Setear datos requeridos para crear Destino (Implosión / resultante).
                    // ====================================================================
                    for (var mObjComponented of mObjKitDetalle.componentesd) {

                        mStrCodArticulo = mObjComponented.codart;

                        var mObjTransforDestino = { 
                            trfd_seqno     : 0,
                            trfh_seqno     : mIntIdTransLogistica, 
                            trfd_codart    : mObjComponented.codart,
                            trfd_varlog    : 0,
                            trfd_numlot    : 0,
                            trfd_coduni    : mObjComponented.unidadmedida,
                            trfd_quantity  : mObjComponented.cantidad
                        }

                        Ax.db.insert("glog_transflog_dst", mObjTransforDestino).getSerial();
                    } 
                    
                    // ==================================================================================
                    // Comprobar que la información obtendida de las recetas coindida con los componentes.
                    // de la orden de producción.  
                    // ================================================================================== 

                    for (var mObjComponenteo of mObjKitDetalle.componenteso) {

                        mObjComponenteo.idtransformacionlogistica = mIntIdTransLogistica;
                        mObjComponenteo.cantidaditems = mObjKitDetalle.cantidaditemso;

                        __validateOrigenDestino('ORIGEN', mObjComponenteo);

                    } 
                } 

                if (mObjData.idtipotransaccion == 13 || mObjData.idtipotransaccion == 14) {

                    // ==================================================================================================
                    // Obtener Producción (alta stock) para validar que se tenga el registro.  
                    // ================================================================================================== 
                    var mRsProduccionAlta = __getGuiaInterna(mObjData.numeroguia,  'AND c.idtipotransaccion IN(16, 17)')

                    // ==================================================================================================
                    // Obtener COMPONENTES (baja stock) para validar que se tenga el registro.  
                    // ================================================================================================== 
                    var mRsComponentes = __getGuiaInterna(mObjData.numeroguia,  'AND c.idtipotransaccion IN(21, 22)')  

                    // ===========================================================================
                    // Cuando se tenga Producción (alta stock) y COMPONENTES (baja stock). 
                    // Validar que coincidan los datos con la orden de producción. 
                    // ===========================================================================        
                    if(mRsProduccionAlta.getRowCount() != 0 && mRsComponentes.getRowCount() != 0){ 

                        for (var mRowProduccionAlta of mRsProduccionAlta) {

                            mRowProduccionAlta.idtransformacionlogistica = mIntIdTransLogistica;
                            mRowProduccionAlta.unidadmedida = __getUnidadMedida(mRowProduccionAlta.unidadingreso);
                            mRowProduccionAlta.cantidaditems = mRsProduccionAlta.getRowCount(); 

                            __validateOrigenDestino('DESTINO', mRowProduccionAlta); 

                        } 

                        for (var mObjComponenteo of mRsComponentes) {

                            mObjComponenteo.idtransformacionlogistica = mIntIdTransLogistica;
                            mObjComponenteo.unidadmedida = __getUnidadMedida(mObjComponenteo.unidadingreso); 
                            mObjComponenteo.cantidaditems = mRsComponentes.getRowCount();

                            __validateOrigenDestino('ORIGEN', mObjComponenteo); 
                        } 

                        mStrMensajeResult = 'Error al procesar la transformación logística';
                        
                        // ===============================================================
                        // Procesar al tener todas las transacciones validadas.
                        // =============================================================== 
                        var mObjEan = __procesarTransLogistica(mIntIdTransLogistica) 

                        mIntTransaccion = mObjEan.m_cabean;
                        mStrDocser = mObjEan.m_docser; 

                    }else{
                        mStrMensaje = 'Se recibió guía interna. A la espera de los documentos complementarios';
                    }                    
                    
                }else{ 
                    mStrMensajeResult = 'Error al procesar la transformación logística';
                    
                    // ===============================================================
                    // Procesar la transformación logistica de O/PRODUCCIÓN MULTIDOSIS.
                    // =============================================================== 
                    var mObjEan = __procesarTransLogistica(mIntIdTransLogistica) 

                    mIntTransaccion = mObjEan.m_cabean; // cabid del movimiento interno
                    mStrDocser = mObjEan.m_docser;

                } 
                
                if (mIntTransaccion) { 

                    mObjDataUpdateGuia.cabid = mIntTransaccion; 
                    mObjDataUpdateGuia.idguiainterna = mIntIdGuia;  
        
                    // ===============================================================
                    // Actualizar movimiento interno y guia interna cabecera y detalle.
                    // =============================================================== 
                    __updatedDataControl(mObjDataUpdateGuia); 

                }else{

                    // =====================================================================
                    // Actualizar guia interna para asociar con la transformación logística
                    // ===================================================================== 
                    mObjDataUpdateGuia.tabdes = 'glog_transflog_head';
                    mObjDataUpdateGuia.cabid = mIntIdTransLogistica;
                    mObjDataUpdateGuia.estado = 0; 
                    mObjDataUpdateGuia.idguiainterna = mIntIdGuia;
                    mObjDataUpdateGuia.updateguiadetalle = 'NO';
                    mObjDataUpdateGuia.updateean = 'NO'; 

                    // ===============================================================
                    // Actualizar guia interna cabecera 
                    // =============================================================== 
                    __updatedDataControl(mObjDataUpdateGuia); 
                } 
            } 

            // BAJA -> 16 P/E COMPONENTES (alta stock)
            // ALTA -> 17 P/E KITS Producción (alta stock) 
            if (mObjData.idtipotransaccion == 16 || mObjData.idtipotransaccion == 17) { 
                
                // =======================================================================
                // Obtener ORDEN DE PRODUCCIÓN para validar que se tenga el registro.  
                // ======================================================================= 
                var mObjOrdenProduccion = __getTransLogisticaHead(mObjData.numeroguia);
                mIntIdTransLogistica = mObjOrdenProduccion.trfh_seqno;

                if (mIntIdTransLogistica) {

                    // =======================================================================
                    // Obtener COMPONENTES (baja stock) para validar que se tenga el registro.  
                    // ======================================================================= 
                    var mRsComponentes = __getGuiaInterna(mObjData.numeroguia, 'AND c.idtipotransaccion IN(21, 22)')

                    if (mRsComponentes.getRowCount() != 0) {

                        // =================================================================================================
                        // Validar que coincidan los datos de PRODUCIÓN(alta stock) con la transformación logística destino. 
                        // =================================================================================================
                        for (var mObjComponented of mObjKitDetalle.componentesd) {

                            mObjComponented.idtransformacionlogistica = mIntIdTransLogistica;
                            mObjComponented.cantidaditems = mObjKitDetalle.cantidaditemsd;

                            __validateOrigenDestino('DESTINO', mObjComponented); 
                        }

                        // =================================================================================================
                        // Validar que coincidan los datos de PRODUCIÓN(baja stock) con la transformación logística origen. 
                        // ================================================================================================= 
                           
                        for (var mObjComponenteo of mRsComponentes) {

                            mObjComponenteo.cantidaditems = mRsComponentes.getRowCount();
                            mObjComponenteo.idtransformacionlogistica = mIntIdTransLogistica;
                            mObjComponenteo.unidadmedida = __getUnidadMedida(mObjComponenteo.unidadingreso); 

                            __validateOrigenDestino('ORIGEN', mObjComponenteo); 
                        } 

                        mStrMensajeResult = 'Error al procesar la transformación logística';
                        
                        // ===============================================================
                        // Procesar al tener todas las transacciones validadas.
                        // =============================================================== 
                        var mObjEan = __procesarTransLogistica(mIntIdTransLogistica) 

                        mIntTransaccion = mObjEan.m_cabean; //Cabid del movimiento interno
                        mStrDocser = mObjEan.m_docser;  

                        if (mIntTransaccion) {

                            mObjDataUpdateGuia.cabid = mIntTransaccion; 
                            mObjDataUpdateGuia.idguiainterna = mObjOrdenProduccion.idguiainterna; 
                
                            // ===============================================================
                            // Actualizar movimiento interno y guia interna cabecera y detalle.
                            // =============================================================== 
                            __updatedDataControl(mObjDataUpdateGuia);

                        }                         
                    }else{
                        
                        mStrMensaje = 'Se recibió guía interna. A la espera de los documentos complementarios';
                    }        
                }else{
                    
                    mStrMensaje = 'Se recibió guía interna. A la espera de los documentos complementarios';
                }   
            }

            // 21 V/C COMPONENTES  (baja stock)
            // 22 V/C KITS  (baja stock)
            if (mObjData.idtipotransaccion == 21 || mObjData.idtipotransaccion == 22) {

                // =======================================================================
                // Obtener ORDEN DE PRODUCCIÓN para validar que se tenga el registro.  
                // ======================================================================= 
                var mObjOrdenProduccion = __getTransLogisticaHead(mObjData.numeroguia);
                mIntIdTransLogistica = mObjOrdenProduccion.trfh_seqno;

                if (mIntIdTransLogistica) {
                    // =======================================================================
                    // Obtener PRODUCCIÓN (alta stock) para validar que se tenga el registro.  
                    // ======================================================================= 
                    var mObjProducionAlta = __getGuiaInterna(mObjData.numeroguia, 'AND c.idtipotransaccion IN(16, 17)') 

                    // ========================================================================
                    // Cuando se tenga ORDEN DE PRODUCIÓN y PRODUCCIÓN (alta stock). 
                    // Validar que coincidan los datos con la orden de producción. 
                    // ========================================================================  
                    if (mObjProducionAlta.getRowCount() != 0) {

                        // =================================================================================================
                        // Validar que coincidan los datos de PRODUCIÓN(alta stock) con la transformación logística destino. 
                        // ================================================================================================= 
                        mRowProduccionAlta.cantidaditems = mObjProducionAlta.getRowCount();

                        for (var mRowProduccionAlta of mObjProducionAlta) {

                            mRowProduccionAlta.idtransformacionlogistica = mIntIdTransLogistica;
                            mRowProduccionAlta.unidadmedida = __getUnidadMedida(mRowProduccionAlta.unidadingreso);

                            __validateOrigenDestino('DESTINO', mRowProduccionAlta); 
                        } 

                        for (var mObjComponenteo of mObjKitDetalle.componenteso) {

                            mObjComponenteo.idtransformacionlogistica = mIntIdTransLogistica;
                            mObjComponenteo.cantidaditems = mObjKitDetalle.cantidaditemso;
                            
                            __validateOrigenDestino('ORIGEN', mObjComponenteo); 
                        } 

                        mStrMensajeResult = 'Error al procesar la transformación logística';
                        
                        // ===============================================================
                        // Procesar al tener todas las transacciones validadas.
                        // =============================================================== 
                        var mObjEan = __procesarTransLogistica(mIntIdTransLogistica) 
                        
                        mIntTransaccion = mObjEan.m_cabean;
                        mStrDocser = mObjEan.m_docser; 

                        if (mIntTransaccion) {

                            mObjDataUpdateGuia.cabid = mIntTransaccion; 
                            mObjDataUpdateGuia.idguiainterna = mObjOrdenProduccion.idguiainterna; 
                
                            // ===============================================================
                            // Actualizar movimiento interno y guia interna cabecera y detalle.
                            // =============================================================== 
                            __updatedDataControl(mObjDataUpdateGuia);
                        } 
                        
                    }else{
                        
                        mStrMensaje = 'Se recibió guía interna. A la espera de los documentos complementarios';
                    }        
                }else{

                    mStrMensaje = 'Se recibió guía interna. A la espera de los documentos complementarios';
                }      
            } 

            Ax.db.commitWork();

        } 
        
        // ===============================================================   
        // Definir mensaje de respuesta
        // ===============================================================
        mObjRequest = {
            response : {  
                code             : '201',
                message          : mStrMensaje,
                idmovimiento     : mIntTransaccion,
                numeromovimiento : mStrDocser
            }
        };
        
        return new Ax.net.HttpResponseBuilder()            
            .status(201)
            .entity(mObjRequest)
            .type("application/json")
            .build(); 
    }
    catch(error) {
        
        Ax.db.rollbackWork(); 
        
        mStrMensajeError = `ERROR [${error.message || error}]`;

        Ax.db.update('crp_crpi_guia_interna', 
            {   
                date_error      : new Ax.util.Date(), 
                message_error   : mStrMensajeError, 
                estado          : 3,
                user_processed  : Ax.ext.user.getCode()
            }, 
            {idguiainterna      : mIntIdGuia}
        ); 
        
        mObjRequest = {
            response : { 
                code      : '406',
                message   : `${mStrMensajeError}`,
                Result    : mStrMensajeResult
            }
        };
        
        return new Ax.net.HttpResponseBuilder()            
        .status(406)
        .entity(mObjRequest)
        .type("application/json")
        .build(); 
    } 
}