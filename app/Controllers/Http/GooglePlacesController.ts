// import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Env from '@ioc:Adonis/Core/Env'
import {Client} from "@googlemaps/google-maps-services-js";
import {Promise} from "bluebird";

export default class GooglePlacesController {
    places_results = new Array;
    types_places = new Array;
    location = '';

    async index({ request }){
        const body = await request.all();
        this.types_places = body.categories.split(',');
        this.location = (body.location) ? body.location : '-20.297071,-40.300555';
        return this.requisitionByTypes();
    }

    async requisitionByTypes(){
        let resultPlaces = new Array;
        let resultPlaces_arr = new Array;
        let resultPlaces_aux = new Array;
        await Promise.each(this.types_places,async (type)=>{
            resultPlaces_aux = await this.requisitionPlaces(resultPlaces,type);
            resultPlaces_arr.push(resultPlaces_aux)
        });
        resultPlaces = resultPlaces_arr.flat(Infinity)
        return this.places_results;
    }

    async requisitionPlaces(resultPlaces,type,next_page:string=''){
        let next:string='';
        let params_r = {
            location: this.location,
            radius:50000,
            key: Env.get('GOOGLE_MAPS_API_KEY'),
            type:type
        };
        if(next_page!=''){
            params_r = {
                location: this.location,
                radius:50000,
                pagetoken:next_page,
                key: Env.get('GOOGLE_MAPS_API_KEY'),
                type:type
            };
        }
        const client = new Client({});

        await client
            .placesNearby({
                params: params_r,
            })
            .then(async (r) => {
                const results = await this.formatPlaces(r.data.results);
                resultPlaces.push(results);
                this.places_results.push(results)
                this.places_results = this.places_results.flat(Infinity)

                if(r.data.next_page_token){
                    next=r.data.next_page_token;
                }
            })
            .catch((e) => {
                console.log(e);
                console.log('error');
            });
        if(next!=''){
            await this.sleep(2000);
            return this.requisitionPlaces(resultPlaces,type,next)
        }
        return resultPlaces;
        
    }

    async formatPlaces(data){
        const resultPlaces= new Array();
        const clientFind = new Client({});
        let types = [];
        let places = await Promise.map(data,async (place)=>{
            const types_f = place.types.flat(Infinity)
            const valid_type = await types_f.filter(element => this.types_places.includes(element))
            const valid_place_id = await this.places_results.find((place_find)=>{
                return place_find.place_id===place.place_id;
            });
            if(valid_type.length && valid_place_id===undefined){
                types = types_f;
                return place
            }
        });

        places = await places.filter((element)=>{
            if(element){
                return element
            }
        });

        await Promise.each(places,async (place)=>{
            await clientFind.placeDetails({
                params: {
                    place_id:place.place_id,
                    key: Env.get('GOOGLE_MAPS_API_KEY'),
                },
            })
            .then(async (r) => {
                const placeData = r.data.result;
                resultPlaces.push(  {
                    'name':placeData.name,
                    'categories':types,
                    'business_status': placeData.business_status,
                    'formatted_phone_number':placeData.formatted_phone_number,
                    'international_phone_number':placeData.international_phone_number,
                    'place_id':placeData.place_id,
                    'url_google_maps':placeData.url,
                    'website':placeData.website
                });
            })
            .catch((e) => {
                console.log(e);
                console.log('error');
            })
        })
        return resultPlaces;
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
