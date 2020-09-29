FROM node:latest

COPY . /home/node

WORKDIR /home/node

EXPOSE 3000/tcp
EXPOSE 40510/tcp

ENTRYPOINT ["node", "server.js", "3000", "40510"]