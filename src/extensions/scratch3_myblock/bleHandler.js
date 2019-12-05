require('babel-polyfill');

class BleHandler{
  constructor (serviceUuid, characteristicUuids) {
    this._serviceUuid = serviceUuid
    this._characteristicUuids = characteristicUuids
    this._characteristics = []
    this._notifyEventListeners = []
  }

  // ///////////////////////////////////////////////////////////////////////
  addNotifyEvent (uuid, handler) {
    const characteristic = this._characteristics.find((characteristic) => uuid === characteristic.uuid)
    if (characteristic) {
      characteristic.handler = handler
    } else {
      this._notifyEventListeners.push({ uuid: uuid, handler: handler })
    }
  }

  // ///////////////////////////////////////////////////////////////////////
  async connect (bluetooth) {
    bluetooth.requestDevice({
      filters: [{
        services: [this._serviceUuid]
      }]
    })
      .then(device => {
        console.log('device find: connecting')
        console.log('device name:' + device.name)
        console.log('ID :' + device.id)
        return device.gatt.connect()
      }).then(server => {
        console.log('BLE connected')
        // - UUID に合致するサービス(機能)を取得
        return server.getPrimaryService(this._serviceUuid)
      }).then(service => {
        console.log('getPrimaryService succeed')

        // - UUIDに合致するキャラクタリスティック(サービスが扱うデータ)を取得
        const promises = []
        for (let i = 0; i < this._characteristicUuids.length; i++) {
          promises.push(service.getCharacteristic(this._characteristicUuids[i]))
        }
        return Promise.all(promises)
      }).then(characteristics => {
        console.log('BLE connection complete.')

        for (let i = 0; i < characteristics.length; i++) {
          this._characteristics.push(characteristics[i])

          // - notification characteristic
          const listener = this._notifyEventListeners.find((listener) => listener.uuid === characteristics[i].uuid)
          const eventListener = (event) => {
            const value = event.target.value

            // データが string の場合
            // const decoder = new TextDecoder('utf-8')
            // const str = decoder.decode(value)
            // console.log(str)

            // データがnumberの場合
            const num = this.getNumber(value)
            // console.log(num)
            listener.handler(num)
          }

          if (listener) {
            characteristics[i].addEventListener('characteristicvaluechanged', eventListener)
            characteristics[i].startNotifications()
              .catch(error => {
                characteristics[i].removeEventListener('characteristicvaluechanged', eventListener)
                console.error(error)
              })
          }
        }
      })
      .catch(error => {
        console.log('error : ' + error)
      })
  }

  // ///////////////////////////////////////////////////////////////////////
  getNumber (dataView) {
    switch (dataView.byteLength) {
      case 0:
        return 0
      case 1:
        return dataView.getUint8(0, true)
      case 2:
        return dataView.getUint16(0, true)
      case 4:
        return dataView.getUint32(0, true)
      case 8: {
        const top = dataView.getUint32(0) * Math.pow(2, 32)
        const bottom = dataView.getUint32(4)
        return top + bottom
      }
      default:
        return 0
    }
  }

  // ///////////////////////////////////////////////////////////////////////
  writeData (uuid, byteArray) {
    const characteristic = this._characteristics.find((characteristic) => uuid === characteristic.uuid)
    characteristic.writeValue(new Uint8Array(byteArray))
  }

  // ///////////////////////////////////////////////////////////////////////
  readData (uuid, byteArray) {
    const characteristic = this._characteristics.find((characteristic) => uuid === characteristic.uuid)
    characteristic.readValue()
      .then(response => {
        // データが string の場合
        // const decoder = new TextDecoder('utf-8')
        // const str = decoder.decode(response)
        // console.log(str)
        // return str

        // データが number の場合
        const num = this.getNumber(response)
        console.log(num)
        return num
      })
      .catch(error => console.error(error))
  }
}

module.exports.BleHandler = BleHandler;