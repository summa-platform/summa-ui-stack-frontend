# SUMMA UI

SUMMA User Interface that connects to [summa-platform](https://github.com/summa-leta/summa-platform) API.

Requires any of the two following setups:

1. Node.js 6+ with NPM 3+
2. docker with docker-compose


### Run without docker
Install Node.js with NPM and install Aurelia CLI globally:

```
$ npm intall -g aurelia-cli
```

To compile and run a webserver:

```
$ au run
```

To auto-recompile on changes for development:

```
$ au run --watch
```

### Run using docker and docker-compose

To start standalone UI, run:

```
$ docker-compose up
```

To rebuild source on running system:

```
$ docker-compose start build
```

Docker configuration uses two separate images: one for building sources, one for serving content and proxying API calls (using nginx).
Such setups allows to keep source directory clean and organized.

Use docker-compose.integrate.yaml as basis for integrating into summa-platform.


### Configuration

Front-end uses API URL specified in ```api-proxy.json``` (sample provided in ```api-proxy.sample.json```), by default it is set to ```/api``` endpoint, which in turn is proxied to the external API configured either in ```api-proxy.conf``` (if run using ```au run```) or ```api-proxy-nginx.conf``` if run in docker.

