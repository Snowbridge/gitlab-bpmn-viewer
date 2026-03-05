class FooBar{
    write(...data){
        console.log('The message', (new Date()).toISOString(), this.constructor.name);
        console.log('[gl-bpmn-viewer] DEBUG','The message', (new Date()).toISOString(), `Logger: ${this.constructor.name}`);
        
        const logger = (new Error().stack).split('\n').slice(2,3)[0].trim();
        console.log('[gl-bpmn-viewer] DEBUG','The message', (new Date()).toISOString(), logger, data);
        console.log('[gl-bpmn-viewer] DEBUG','The message', (new Date()).toISOString(), logger, ...data);
        console.log('[gl-bpmn-viewer] DEBUG','The message', (new Date()).toISOString(), {
            context:{
                logger: logger,
                data: data
            }
        });
    }
}
function foo(){
    const fooBar = new FooBar();
    fooBar.write("one", 2, fooBar);
}

foo();

class Bar{
    init(){
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        setTimeout(()=>{
            self.#somePrivate();
        }, 1500);
    }
    #somePrivate(){
        console.log(`Hey, I'm private method`);
    }
}

const bar = new Bar();
bar.init();