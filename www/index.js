var app = new Vue({ 
    el: '#app',
    data: {
        config: [],
    },
    beforeMount() {
        this.getConfig();
    },
    methods: {
        async getConfig() {
          const res = await fetch("/config");
          this.config = await res.json();
        },
        async sendON(id) {
          let data = {cmd: "ON",
                      id: id,
                      value: -1};
          await this.send(data);

        },
        async sendOFF(event) {
        },
        async send(sendData) {
          this.ToolSuccess='';
          this.ToolError='';
          fetch('/sendUDP', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(sendData),
          })
          .then(response => response.json())
          .then(data => {
            console.log('Success:', data);
            if(data.success)
              this.ToolSuccess=JSON.stringify(data);
            else 
              this.ToolError=JSON.stringify(data);
          })
          .catch((error) => {
            console.error('Error:', error);
            this.ToolError=JSON.stringify(error);
          });
      }
    },
    computed: {

    }
});

